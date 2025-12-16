// 配置对象从config.js加载

// 全局变量
let musicXmlData = null;
let tempoData = [];
let minimaData = [];
let systems = []; // 存储每个系统的信息
let measureToSystemMap = new Map(); // measure编号到系统索引的映射
let currentLevel = 1; // 当前选择的level
let levelDataCache = {}; // 缓存各level的数据
let showMinimaLines = false; // 控制是否显示分割线（红线）
let debugMode = false; // 控制是否启用调试模式

// 将systems暴露到全局作用域，方便控制面板调用
window.systems = systems;

// 初始化
async function init() {
    try {
        // 加载配置（从CSS变量读取初始值）
        ChartConfig.load();
        
        // 应用配置到CSS变量
        ChartConfig.apply();
        
        // 加载MusicXML
        const xmlResponse = await fetch('Player_1/music.xml');
        const xmlText = await xmlResponse.text();
        musicXmlData = xmlText;
        
        // 预计算measure durations
        measureDurations = calculateMeasureDurations();
        
        // 解析MusicXML，提取系统信息（会根据窗口宽度自动计算）
        parseMusicXMLSystems();
        
        // 设置窗口大小变化监听，重新组织系统
        setupWindowResizeHandler();
        
        // 设置level选择器事件
        setupLevelSelector();
        
        // 设置分割线切换按钮事件
        setupToggleLinesButton();
        
        // 设置调试模式按钮事件
        setupDebugButton();
        
        // 加载默认level数据并渲染
        await loadAndRenderLevel(1);
        
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('初始化错误:', error);
        document.getElementById('loading').textContent = '加载失败: ' + error.message;
    }
}

// 设置窗口大小变化监听器
function setupWindowResizeHandler() {
    let resizeTimeout;
    
    window.addEventListener('resize', () => {
        // 防抖处理，避免频繁重新渲染
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(async () => {
            console.log('窗口大小变化，重新组织系统...');
            
            // 重新组织系统
            reorganizeSystemsByWindowWidth();
            
            // 重新渲染当前level
            document.getElementById('loading').style.display = 'block';
            document.getElementById('loading').textContent = '正在重新渲染...';
            
            await loadAndRenderLevel(currentLevel);
            
            document.getElementById('loading').style.display = 'none';
        }, 300); // 300ms防抖延迟
    });
}

// 设置level选择器
function setupLevelSelector() {
    const buttons = document.querySelectorAll('.level-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const level = parseInt(btn.getAttribute('data-level'));
            
            // 更新按钮状态
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 加载并渲染对应level
            currentLevel = level;
            document.getElementById('loading').style.display = 'block';
            document.getElementById('loading').textContent = `正在加载Level ${level}数据...`;
            
            await loadAndRenderLevel(level);
            
            document.getElementById('loading').style.display = 'none';
        });
    });
    
    // 默认选中level 1
    document.querySelector('.level-btn[data-level="1"]').classList.add('active');
}

// 设置分割线切换按钮
function setupToggleLinesButton() {
    const toggleBtn = document.getElementById('toggleLinesBtn');
    if (!toggleBtn) return;
    
    toggleBtn.addEventListener('click', () => {
        // 切换显示状态
        showMinimaLines = !showMinimaLines;
        
        // 更新按钮文本和状态
        if (showMinimaLines) {
            toggleBtn.textContent = '隐藏分割线';
            toggleBtn.classList.add('active');
        } else {
            toggleBtn.textContent = '显示分割线';
            toggleBtn.classList.remove('active');
        }
        
        // 重新渲染所有系统的分割线
        if (window.systems && window.systems.length > 0) {
            for (let i = 0; i < window.systems.length; i++) {
                if (typeof window.addFullHeightMinimaLines === 'function') {
                    window.addFullHeightMinimaLines(i);
                }
            }
        }
    });
}

// 设置调试模式按钮
function setupDebugButton() {
    const debugBtn = document.getElementById('debugBtn');
    if (!debugBtn) return;
    
    debugBtn.addEventListener('click', () => {
        // 切换调试模式状态
        debugMode = !debugMode;
        
        // 更新按钮文本和状态
        if (debugMode) {
            debugBtn.textContent = '退出调试';
            debugBtn.classList.add('active');
            // 启用调试模式，监听鼠标点击
            enableDebugMode();
        } else {
            debugBtn.textContent = '调试模式';
            debugBtn.classList.remove('active');
            // 禁用调试模式
            disableDebugMode();
        }
    });
}

// 启用调试模式
function enableDebugMode() {
    // 清除之前可能存在的调试线
    clearDebugLines();
    
    // 添加点击事件监听器
    document.addEventListener('click', handleDebugClick, true);
}

// 禁用调试模式
function disableDebugMode() {
    // 移除点击事件监听器
    document.removeEventListener('click', handleDebugClick, true);
    
    // 清除所有调试线
    clearDebugLines();
}

// 处理调试模式的点击事件
function handleDebugClick(event) {
    // 如果点击的是调试按钮本身，不处理
    if (event.target.id === 'debugBtn' || event.target.closest('#debugBtn')) {
        return;
    }
    
    // 阻止事件冒泡，避免触发其他点击事件
    event.stopPropagation();
    
    // 获取点击位置的x坐标
    const x = event.clientX;
    
    // 创建调试线
    createDebugLine(x);
}

// 创建调试线
function createDebugLine(x) {
    // 创建竖线元素
    const line = document.createElement('div');
    line.className = 'debug-line';
    line.style.left = `${x}px`;
    
    // 创建标签元素
    const label = document.createElement('div');
    label.className = 'debug-label';
    label.textContent = `X: ${x}px`;
    label.style.left = `${x}px`;
    
    // 添加到body
    document.body.appendChild(line);
    document.body.appendChild(label);
    
    // 存储引用以便后续清除
    if (!window.debugLines) {
        window.debugLines = [];
    }
    window.debugLines.push({ line, label });
}

// 清除所有调试线
function clearDebugLines() {
    if (window.debugLines) {
        window.debugLines.forEach(({ line, label }) => {
            if (line && line.parentNode) {
                line.parentNode.removeChild(line);
            }
            if (label && label.parentNode) {
                label.parentNode.removeChild(label);
            }
        });
        window.debugLines = [];
    }
    
    // 也清除可能遗留的元素
    const existingLines = document.querySelectorAll('.debug-line');
    existingLines.forEach(line => line.remove());
    const existingLabels = document.querySelectorAll('.debug-label');
    existingLabels.forEach(label => label.remove());
}

// 加载并渲染指定level
async function loadAndRenderLevel(level) {
    try {
        // 加载CSV数据
        await loadCSVData(level);
        
        // 清空现有内容
        const contentDiv = document.getElementById('content');
        contentDiv.innerHTML = '';
        
        // 清除之前的缓存数据
        Object.keys(window).forEach(key => {
            if (key.startsWith('systemMinima_')) {
                delete window[key];
            }
        });
        
        // 渲染所有系统
        await renderAllSystems();
    } catch (error) {
        console.error(`加载Level ${level}失败:`, error);
        document.getElementById('loading').textContent = `加载Level ${level}失败: ${error.message}`;
    }
}

// 加载CSV数据
async function loadCSVData(level = 1) {
    // 如果已缓存，直接使用
    if (levelDataCache[level]) {
        tempoData = levelDataCache[level];
        return;
    }
    
    // 加载对应level的数据
    const levelResponse = await fetch(`Player_1/mazurka174_Player_1_level_${level}.csv`);
    const levelText = await levelResponse.text();
    const levelData = parseCSV(levelText);
    
    // 将level数据转换为tempo数据格式
    // level文件格式: Index, Energy_Value, Minima_Indices
    // 转换为: index, tempo, is_local_minima
    tempoData = levelData.map(row => ({
        index: row.Index,
        tempo: row.Energy_Value,
        is_local_minima: row.Minima_Indices === '1' ? '1' : '0'
    }));
    
    // 缓存数据
    levelDataCache[level] = tempoData;
    
}

// 解析CSV
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const obj = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = values[index]?.trim();
        });
        data.push(obj);
    }
    
    return data;
}

// 根据窗口宽度重新组织系统
function reorganizeSystemsByWindowWidth() {
    if (!musicXmlData) {
        console.warn('MusicXML数据未加载，无法重组系统');
        return;
    }
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(musicXmlData, 'text/xml');
    
    // 获取第一个part的所有measure
    const part1 = xmlDoc.querySelector('part[id="P1"]');
    if (!part1) return;
    
    const part1Measures = part1.getElementsByTagName('measure');
    if (part1Measures.length === 0) return;
    
    // 获取容器宽度（优先使用容器，如果容器不存在则使用窗口宽度）
    let containerWidth = window.innerWidth;
    const container = document.querySelector('.container');
    if (container && container.offsetWidth > 0) {
        containerWidth = container.offsetWidth;
    } else {
        // 如果容器还没有渲染，使用窗口宽度减去边距估算
        containerWidth = Math.min(window.innerWidth - 40, 1400); // 1400是max-width
    }
    
    // 获取配置参数
    const minMeasureWidth = ChartConfig.minMeasureWidth || 200;
    
    // 根据窗口宽度计算每个系统可以显示多少个小节
    // 使用 minMeasureWidth 来估算每个小节需要的宽度
    const measuresPerSystem = Math.max(1, Math.floor(containerWidth / minMeasureWidth));
    
    // 限制每个系统的小节数在合理范围内（1-10个小节）
    const measuresPerSystemClamped = Math.max(1, Math.min(10, measuresPerSystem));
    
    console.log(`窗口宽度: ${containerWidth}px, 每个小节估算宽度: ${minMeasureWidth}px, 每个系统显示: ${measuresPerSystemClamped} 个小节`);
    
    // 清空现有系统
    systems = [];
    measureToSystemMap.clear();
    
    // 重新组织系统
    // 每个系统从计算出的初始小节数开始，然后根据换行条件往下减
    let currentSystemIndex = 0;
    let currentSystemMeasures = [];
    
    for (let i = 0; i < part1Measures.length; i++) {
        const measure = part1Measures[i];
        currentSystemMeasures.push(measure);
        
        // 当达到计算出的初始小节数时，创建新系统（必须正好达到）
        if (currentSystemMeasures.length === measuresPerSystemClamped) {
            systems.push({
                index: currentSystemIndex,
                measures: [...currentSystemMeasures],
                startMeasure: currentSystemMeasures[0],
                endMeasure: currentSystemMeasures[currentSystemMeasures.length - 1]
            });
            
            // 更新measure到系统的映射
            currentSystemMeasures.forEach(m => {
                measureToSystemMap.set(parseInt(m.getAttribute('number')), currentSystemIndex);
            });
            
            currentSystemIndex++;
            currentSystemMeasures = [];
        }
    }
    
    // 添加最后一个系统（如果有剩余的小节，但不足初始小节数）
    // 注意：最后一个系统可能少于初始小节数，这是正常的
    if (currentSystemMeasures.length > 0) {
        systems.push({
            index: currentSystemIndex,
            measures: [...currentSystemMeasures],
            startMeasure: currentSystemMeasures[0],
            endMeasure: currentSystemMeasures[currentSystemMeasures.length - 1]
        });
        
        currentSystemMeasures.forEach(m => {
            measureToSystemMap.set(parseInt(m.getAttribute('number')), currentSystemIndex);
        });
        
        console.log(`最后一个系统包含 ${currentSystemMeasures.length} 个小节（不足 ${measuresPerSystemClamped} 个，这是正常的）`);
    }
    
    // 更新全局systems引用
    window.systems = systems;
    
    // 存储初始小节数，供后续调整时参考
    window.initialMeasuresPerSystem = measuresPerSystemClamped;
}

// 解析MusicXML，提取系统信息（保留原函数，但改为调用新的重组函数）
function parseMusicXMLSystems() {
    // 根据窗口宽度重新组织系统
    reorganizeSystemsByWindowWidth();
}

// 计算每个measure的duration（以divisions为单位）
function calculateMeasureDurations() {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(musicXmlData, 'text/xml');
    const part1 = xmlDoc.querySelector('part[id="P1"]');
    if (!part1) return [];
    
    const measures = part1.getElementsByTagName('measure');
    const measureDurations = [];
    let cumulativeDivisions = 0;
    
    for (let i = 0; i < measures.length; i++) {
        const measure = measures[i];
        let measureDivisions = 0;
        
        // 获取divisions（通常在attributes中）
        const attributes = measure.getElementsByTagName('attributes')[0];
        let divisions = 24; // 默认值
        if (attributes) {
            const divs = attributes.getElementsByTagName('divisions')[0];
            if (divs) {
                divisions = parseInt(divs.textContent);
            }
        }
        
        // 计算measure的总duration
        const notes = measure.getElementsByTagName('note');
        for (let j = 0; j < notes.length; j++) {
            const duration = notes[j].getElementsByTagName('duration')[0];
            if (duration) {
                measureDivisions += parseInt(duration.textContent);
            }
        }
        
        measureDurations.push({
            measureNumber: i + 1,
            divisions: measureDivisions,
            cumulativeDivisions: cumulativeDivisions,
            divisionsPerMeasure: divisions
        });
        
        cumulativeDivisions += measureDivisions;
    }
    
    return measureDurations;
}

// 获取拍号信息（beats per measure）
function getTimeSignature() {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(musicXmlData, 'text/xml');
    const part1 = xmlDoc.querySelector('part[id="P1"]');
    if (!part1) return { beats: 3, beatType: 4 }; // 默认3/4拍
    
    const firstMeasure = part1.querySelector('measure');
    if (!firstMeasure) return { beats: 3, beatType: 4 };
    
    const attributes = firstMeasure.querySelector('attributes');
    if (!attributes) return { beats: 3, beatType: 4 };
    
    const time = attributes.querySelector('time');
    if (!time) return { beats: 3, beatType: 4 };
    
    const beats = parseInt(time.querySelector('beats')?.textContent || '3');
    const beatType = parseInt(time.querySelector('beat-type')?.textContent || '4');
    
    return { beats, beatType };
}

// 获取竖线向左偏移的倍数（统一管理，从配置对象读取）
function getLineOffsetScale() {
    return ChartConfig.lineOffsetScale;
}

// 将index转换为measure位置（基于实际的measure duration）
let measureDurations = null;
let timeSignature = null;

function indexToMeasure(index) {
    if (!measureDurations) {
        measureDurations = calculateMeasureDurations();
    }
    
    if (!timeSignature) {
        timeSignature = getTimeSignature();
    }
    
    // 使用实际的拍号信息
    const beatsPerMeasure = timeSignature.beats;
    // 计算measureNumber，不使用Math.min限制，让调用者决定是否在范围内
    const measureNumber = Math.floor(index / beatsPerMeasure) + 1;
    const beatInMeasure = (index % beatsPerMeasure);
    
    return { 
        measureNumber, 
        beatInMeasure,
        positionInMeasure: beatInMeasure / beatsPerMeasure // 0-1之间的位置
    };
}

// 获取某个measure在某个系统中的x位置（相对位置）
function getMeasureXPosition(measureNumber, systemIndex, positionInMeasure = 0) {
    const system = systems[systemIndex];
    if (!system) return 0;
    
    const measureIndex = system.measures.findIndex(m => 
        parseInt(m.getAttribute('number')) === measureNumber
    );
    
    if (measureIndex === -1) return 0;
    
    // 计算在系统中的位置（0-1之间）
    // positionInMeasure是measure内的位置（0-1）
    const measurePosition = measureIndex / system.measures.length;
    const measureWidth = 1 / system.measures.length;
    const position = measurePosition + (positionInMeasure * measureWidth);
    
    return Math.max(0, Math.min(1, position));
}

// 计算所有系统的最大x值（用于统一x轴范围）
// 如果提供了 measurePositionsMap，将使用实际小节位置计算；否则使用固定间距
function calculateMaxXValue(measurePositionsMap = null) {
    if (!timeSignature) {
        timeSignature = getTimeSignature();
    }
    const beatsPerMeasure = timeSignature.beats;
    const measureSpacing = ChartConfig.measureSpacing;
    const beatSpacing = ChartConfig.beatSpacing;
    const leadingSpacing = ChartConfig.leadingSpacing;
    const leadingWidth = leadingSpacing * beatSpacing;
    
    let maxX = 0;
    
    // 遍历所有系统，计算每个系统的最大x值
    for (let i = 0; i < systems.length; i++) {
        const system = systems[i];
        const startMeasure = parseInt(system.startMeasure.getAttribute('number'));
        const endMeasure = parseInt(system.endMeasure.getAttribute('number'));
        const numberOfMeasures = system.measures.length; // 使用实际的小节数量
        const expectedBeats = beatsPerMeasure * numberOfMeasures;
        const startIndex = (startMeasure - 1) * beatsPerMeasure;
        
        // 如果提供了该系统的实际小节位置，使用实际位置计算
        if (measurePositionsMap && measurePositionsMap.has(i)) {
            const measurePositions = measurePositionsMap.get(i);
            if (measurePositions && measurePositions.length > 0) {
                // 计算最后一个beat的x坐标（使用实际小节位置）
                const lastBeatIndex = expectedBeats - 1;
                const lastBeatInMeasure = lastBeatIndex % beatsPerMeasure;
                const lastMeasureNumber = endMeasure;
                
                // 查找最后一个小节的位置
                const lastMeasurePos = measurePositions.find(p => p.measureNumber === lastMeasureNumber);
                if (lastMeasurePos && lastMeasurePos.relativeX !== undefined) {
                    // 计算最后一个beat在小节内的相对位置
                    const beatPositionInMeasure = lastBeatInMeasure / beatsPerMeasure;
                    const beatRelativeX = lastMeasurePos.relativeX + (beatPositionInMeasure * lastMeasurePos.width);
                    
                    // 计算乐谱的总相对宽度
                    const firstMeasurePos = measurePositions[0];
                    const totalScoreRelativeWidth = lastMeasurePos.relativeX + lastMeasurePos.width;
                    
                    // 计算缩放比例（与renderChart中的逻辑一致）
                    const expectedChartWidth = expectedBeats * beatSpacing;
                    const scaleFactor = totalScoreRelativeWidth > 0 ? expectedChartWidth / totalScoreRelativeWidth : 1;
                    
                    // 计算最后一个beat的x坐标
                    const lastX = leadingWidth + beatRelativeX * scaleFactor;
                    maxX = Math.max(maxX, lastX);
                    continue;
                }
            }
        }
        
        // 使用固定间距计算（备用方法）
        const lastBeatIndex = expectedBeats - 1;
        const completedMeasures = Math.floor(lastBeatIndex / beatsPerMeasure);
        const extraMeasureSpacing = completedMeasures * (measureSpacing - 1) * beatsPerMeasure * beatSpacing;
        const lastX = leadingWidth + lastBeatIndex * beatSpacing + extraMeasureSpacing;
        
        maxX = Math.max(maxX, lastX);
    }
    
    return maxX;
}

// 检测乐谱是否有换行
function detectLineBreak(systemIndex) {
    const scoreDiv = document.getElementById(`score-${systemIndex}`);
    if (!scoreDiv) return false;
    
    const svg = scoreDiv.querySelector('svg');
    if (!svg) return false;
    
    const system = systems[systemIndex];
    if (!system) return false;
    
    try {
        const measurePositions = window[`systemMeasurePositions_${systemIndex}`];
        if (!measurePositions || measurePositions.length === 0) return false;
        
        // 检测小节位置是否有明显的跳跃（换行标志）
        // 如果小节的x坐标突然变小（相对于前一个小节），说明换行了
        for (let i = 1; i < measurePositions.length; i++) {
            const prevPos = measurePositions[i - 1];
            const currPos = measurePositions[i];
            
            // 如果相对位置突然变小（说明换行了），或者x坐标变小
            if (currPos.relativeX < prevPos.relativeX - 5 || currPos.x < prevPos.x - 5) {
                console.log(`系统 ${systemIndex}: 检测到换行在小节 ${currPos.measureNumber}`);
                return true;
            }
        }
        
        // 检测SVG宽度是否超出容器（可能有换行）
        const containerWidth = scoreDiv.offsetWidth;
        const svgBbox = svg.getBBox();
        const svgWidth = svgBbox.width;
        
        // 如果SVG高度明显大于正常高度，可能有换行
        const svgHeight = svgBbox.height;
        // 正常单行乐谱高度通常在200-300px左右，如果超过400px可能有换行
        if (svgHeight > 400 && measurePositions.length > 1) {
            console.log(`系统 ${systemIndex}: SVG高度异常 (${svgHeight}px)，可能换行`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`检测换行时出错:`, error);
        return false;
    }
}

// 调整系统的小节数量（减少1个小节）
// 注意：每个系统从初始小节数开始（根据窗口大小计算），然后根据换行条件往下减
function adjustSystemMeasures(systemIndex) {
    const system = systems[systemIndex];
    // 确保至少保留1个小节
    if (!system || system.measures.length <= 1) {
        console.warn(`系统 ${systemIndex}: 无法再减少小节，当前只有 ${system.measures.length} 个小节`);
        return false;
    }
    
    // 获取初始小节数（如果存在）
    const initialMeasures = window.initialMeasuresPerSystem || 7;
    
    // 移除最后一个小节
    const removedMeasure = system.measures.pop();
    system.endMeasure = system.measures[system.measures.length - 1];
    
    // 更新measure到系统的映射
    measureToSystemMap.delete(parseInt(removedMeasure.getAttribute('number')));
    
    console.log(`系统 ${systemIndex}: 移除小节 ${removedMeasure.getAttribute('number')}，现在包含 ${system.measures.length} 个小节（从初始 ${initialMeasures} 个减少）`);
    
    // 如果有下一个系统，尝试将移除的小节添加到下一个未满的系统
    if (systemIndex + 1 < systems.length) {
        // 查找下一个未满的系统（少于初始小节数）
        let foundTargetSystem = false;
        for (let i = systemIndex + 1; i < systems.length; i++) {
            const targetSystem = systems[i];
            if (targetSystem.measures.length < initialMeasures) {
                // 找到未满的系统，在开头插入移除的小节
                targetSystem.measures.unshift(removedMeasure);
                targetSystem.startMeasure = removedMeasure;
                measureToSystemMap.set(parseInt(removedMeasure.getAttribute('number')), i);
                console.log(`系统 ${i}: 添加小节 ${removedMeasure.getAttribute('number')} 到开头，现在包含 ${targetSystem.measures.length} 个小节`);
                foundTargetSystem = true;
                break;
            }
        }
        
        // 如果所有后续系统都已满（达到初始小节数），将小节添加到最后一个系统的末尾
        // 这样在后续调整时，这个小节会被重新分配，而不是创建只有1个小节的新系统
        if (!foundTargetSystem) {
            const lastSystem = systems[systems.length - 1];
            lastSystem.measures.push(removedMeasure);
            lastSystem.endMeasure = removedMeasure;
            measureToSystemMap.set(parseInt(removedMeasure.getAttribute('number')), systems.length - 1);
            console.log(`所有后续系统都已满（${initialMeasures}个小节），将小节 ${removedMeasure.getAttribute('number')} 添加到最后一个系统 ${systems.length - 1}，现在包含 ${lastSystem.measures.length} 个小节（将等待后续调整）`);
        }
    } else {
        // 如果没有下一个系统，将小节添加到最后一个系统的末尾
        // 这样在后续调整时，这个小节会被重新分配
        const lastSystem = systems[systems.length - 1];
        if (lastSystem !== system) {
            lastSystem.measures.push(removedMeasure);
            lastSystem.endMeasure = removedMeasure;
            measureToSystemMap.set(parseInt(removedMeasure.getAttribute('number')), systems.length - 1);
            console.log(`没有下一个系统，将小节 ${removedMeasure.getAttribute('number')} 添加到最后一个系统 ${systems.length - 1}，现在包含 ${lastSystem.measures.length} 个小节`);
        } else {
            // 如果当前系统就是最后一个系统，暂时保留这个小节
            // 但这种情况不应该发生，因为如果当前系统是最后一个，它不应该检测到换行
            console.warn(`系统 ${systemIndex} 是最后一个系统，但检测到换行，将小节 ${removedMeasure.getAttribute('number')} 保留在当前系统`);
            system.measures.push(removedMeasure);
            system.endMeasure = removedMeasure;
        }
    }
    
    // 更新全局systems引用
    window.systems = systems;
    
    return true;
}

// 渲染单个系统（带容器创建）
async function createAndRenderSystem(systemIndex) {
    const contentDiv = document.getElementById('content');
    const system = systems[systemIndex];
    
    // 创建系统容器
    const rowDiv = document.createElement('div');
    rowDiv.className = 'system-row';
    rowDiv.id = `system-${systemIndex}`;
    
    // 系统信息
    const infoDiv = document.createElement('div');
    infoDiv.className = 'system-info';
    const startMeasure = parseInt(system.startMeasure.getAttribute('number'));
    const endMeasure = parseInt(system.endMeasure.getAttribute('number'));
    infoDiv.textContent = `系统 ${systemIndex + 1} - 小节 ${startMeasure} 到 ${endMeasure}`;
    rowDiv.appendChild(infoDiv);
    
    // 乐谱容器
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'score-container';
    scoreDiv.id = `score-${systemIndex}`;
    rowDiv.appendChild(scoreDiv);
    
    // 图表容器
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';
    chartDiv.id = `chart-${systemIndex}`;
    rowDiv.appendChild(chartDiv);
    
    contentDiv.appendChild(rowDiv);
    
    // 渲染乐谱和图表
    await renderSystem(systemIndex);
}

// 渲染所有系统（带自动换行检测）
async function renderAllSystems() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // 清空内容
    
    let systemIndex = 0;
    const maxIterations = 100; // 防止无限循环
    let iteration = 0;
    
    while (systemIndex < systems.length && iteration < maxIterations) {
        iteration++;
        
        // 创建并渲染当前系统
        await createAndRenderSystem(systemIndex);
        
        // 等待一小段时间确保渲染完成
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 检测是否有换行
        const hasLineBreak = detectLineBreak(systemIndex);
        
        if (hasLineBreak) {
            console.log(`系统 ${systemIndex} 检测到换行，调整小节数量...`);
            
            // 调整系统的小节数量（减少1个）
            const adjusted = adjustSystemMeasures(systemIndex);
            
            if (adjusted) {
                // 清除当前系统的容器和缓存（包括图表）
                const rowDiv = document.getElementById(`system-${systemIndex}`);
                if (rowDiv) {
                    // 清除图表实例（如果存在）
                    const chartDiv = document.getElementById(`chart-${systemIndex}`);
                    if (chartDiv) {
                        const canvas = chartDiv.querySelector('canvas');
                        if (canvas) {
                            const chartInstance = Chart.getChart(canvas);
                            if (chartInstance) {
                                chartInstance.destroy();
                            }
                        }
                    }
                    rowDiv.remove();
                }
                delete window[`systemMeasurePositions_${systemIndex}`];
                delete window[`systemMinima_${systemIndex}`];
                
                // 如果调整后创建了新系统，也需要清除后续系统的容器和图表
                for (let i = systemIndex + 1; i < systems.length; i++) {
                    const nextRowDiv = document.getElementById(`system-${i}`);
                    if (nextRowDiv) {
                        // 清除图表实例
                        const chartDiv = document.getElementById(`chart-${i}`);
                        if (chartDiv) {
                            const canvas = chartDiv.querySelector('canvas');
                            if (canvas) {
                                const chartInstance = Chart.getChart(canvas);
                                if (chartInstance) {
                                    chartInstance.destroy();
                                }
                            }
                        }
                        nextRowDiv.remove();
                    }
                    delete window[`systemMeasurePositions_${i}`];
                    delete window[`systemMinima_${i}`];
                }
                
                // 不增加systemIndex，重新渲染当前系统（包括乐谱和图表）
                continue;
            }
        }
        
        // 没有换行，继续下一个系统
        systemIndex++;
    }
    
    if (iteration >= maxIterations) {
        console.warn(`达到最大迭代次数 ${maxIterations}，停止渲染`);
    }
    
    console.log(`渲染完成，共 ${systems.length} 个系统，每个系统使用独立的x轴范围`);
}

// 渲染单个系统
async function renderSystem(systemIndex) {
    const system = systems[systemIndex];
    
    // 渲染乐谱，并获取小节位置信息
    const measurePositions = await renderScore(systemIndex);
    
    // 对齐图表位置到乐谱的起始位置（在渲染图表之前）
    alignChartToScore(systemIndex);
    
    // 等待一小段时间确保对齐完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 渲染折线图，传入小节位置信息用于对齐
    renderChart(systemIndex, null, measurePositions);
}

// 检测乐谱中第一个和最后一个音符的位置
function detectNotePositions(systemIndex) {
    const scoreDiv = document.getElementById(`score-${systemIndex}`);
    if (!scoreDiv) return null;
    
    const svg = scoreDiv.querySelector('svg');
    if (!svg) return null;
    
    try {
        // 获取SVG的边界框
        const svgBbox = svg.getBBox();
        
        // 方法1: 查找所有可能的音符元素（notehead通常是圆形或椭圆形）
        // OpenSheetMusicDisplay使用特定的类名和结构
        const noteheads = svg.querySelectorAll('circle, ellipse, g[class*="notehead"], g[class*="Notehead"], .osmd-notehead');
        
        let minX = Infinity;
        let maxX = -Infinity;
        let foundNotes = false;
        
        if (noteheads.length > 0) {
            noteheads.forEach(el => {
                try {
                    const bbox = el.getBBox();
                    // 音符头通常在合理的尺寸范围内
                    if (bbox.width > 0 && bbox.width < 100 && bbox.height > 0 && bbox.height < 100) {
                        minX = Math.min(minX, bbox.x);
                        maxX = Math.max(maxX, bbox.x + bbox.width);
                        foundNotes = true;
                    }
                } catch (e) {
                    // 忽略无法获取bbox的元素
                }
            });
        }
        
        // 方法2: 如果没找到音符头，查找所有图形元素，筛选出可能是音符的
        if (!foundNotes) {
            const allElements = svg.querySelectorAll('g, circle, ellipse');
            const potentialNotes = [];
            
            allElements.forEach(el => {
                try {
                    const bbox = el.getBBox();
                    // 音符通常有特定的尺寸和位置特征
                    // 排除太小的（可能是装饰）和太大的（可能是小节线等）
                    if (bbox.width > 2 && bbox.width < 80 && 
                        bbox.height > 2 && bbox.height < 80 &&
                        bbox.y > svgBbox.y && bbox.y < svgBbox.y + svgBbox.height * 0.8) {
                        potentialNotes.push(el);
                    }
                } catch (e) {
                    // 忽略无法获取bbox的元素
                }
            });
            
            if (potentialNotes.length > 0) {
                potentialNotes.forEach(el => {
                    try {
                        const bbox = el.getBBox();
                        minX = Math.min(minX, bbox.x);
                        maxX = Math.max(maxX, bbox.x + bbox.width);
                        foundNotes = true;
                    } catch (e) {
                        // 忽略
                    }
                });
            }
        }
        
        // 方法3: 如果还是没找到，使用小节位置信息
        if (!foundNotes) {
            const measurePositions = window[`systemMeasurePositions_${systemIndex}`];
            if (measurePositions && measurePositions.length > 0) {
                const firstMeasure = measurePositions[0];
                const lastMeasure = measurePositions[measurePositions.length - 1];
                
                // 使用第一个小节的开始位置和最后一个小节的结束位置
                minX = firstMeasure.x;
                maxX = lastMeasure.x + lastMeasure.width;
                foundNotes = true;
            }
        }
        
        if (foundNotes && minX !== Infinity && maxX !== -Infinity) {
            return { firstNoteX: minX, lastNoteX: maxX };
        }
        
        return null;
    } catch (error) {
        console.error(`系统 ${systemIndex + 1}: 检测音符位置时出错:`, error);
        return null;
    }
}

// 根据乐谱的第一个和最后一个音符位置设置图表大小和位置
function alignChartToScore(systemIndex) {
    const scoreDiv = document.getElementById(`score-${systemIndex}`);
    const chartDiv = document.getElementById(`chart-${systemIndex}`);
    
    if (!scoreDiv || !chartDiv) return;
    
    // 等待一小段时间确保SVG已渲染
    setTimeout(() => {
        const svg = scoreDiv.querySelector('svg');
        if (!svg) {
            console.warn(`系统 ${systemIndex + 1}: 未找到SVG，无法对齐图表位置`);
            return;
        }
        
        try {
            // 检测第一个和最后一个音符的位置
            const notePositions = detectNotePositions(systemIndex);
            
            if (!notePositions) {
                // 如果无法检测音符位置，使用SVG的边界框
                const svgBbox = svg.getBBox();
                const svgRect = svg.getBoundingClientRect();
                const scoreDivRect = scoreDiv.getBoundingClientRect();
                
                const baseScoreStartX = svgRect.left - scoreDivRect.left;
                const chartWidth = svgRect.width;
                
                // 应用chartOffsetX参数来调整图表位置
                const chartOffsetX = ChartConfig.chartOffsetX || 0;
                const scoreStartX = baseScoreStartX + chartOffsetX;
                
                chartDiv.style.left = `${scoreStartX}px`;
                chartDiv.style.width = `${chartWidth}px`;
                chartDiv.style.position = 'relative';
                
                console.log(`系统 ${systemIndex + 1}: 使用SVG边界框，位置: ${scoreStartX.toFixed(2)}px (基础: ${baseScoreStartX.toFixed(2)}px, 偏移: ${chartOffsetX}px), 宽度: ${chartWidth.toFixed(2)}px`);
                return;
            }
            
            // 获取SVG在页面中的位置
            const svgRect = svg.getBoundingClientRect();
            const scoreDivRect = scoreDiv.getBoundingClientRect();
            const svgBbox = svg.getBBox();
            
            // 计算第一个音符相对于scoreDiv的位置
            // SVG的getBBox()返回的是相对于SVG viewBox的坐标
            // 需要转换为相对于scoreDiv的像素坐标
            const svgScaleX = svgRect.width / svgBbox.width;
            const svgScaleY = svgRect.height / svgBbox.height;
            
            const firstNotePixelX = (notePositions.firstNoteX - svgBbox.x) * svgScaleX;
            const lastNotePixelX = (notePositions.lastNoteX - svgBbox.x) * svgScaleX;
            
            // 计算图表的位置和宽度
            const baseChartStartX = svgRect.left - scoreDivRect.left + firstNotePixelX;
            const chartWidth = lastNotePixelX - firstNotePixelX;
            
            // 应用chartOffsetX参数来调整图表位置（正数向右，负数向左）
            const chartOffsetX = ChartConfig.chartOffsetX || 0;
            const chartStartX = baseChartStartX + chartOffsetX;
            
            // 设置图表容器的位置和宽度
            chartDiv.style.left = `${chartStartX}px`;
            chartDiv.style.width = `${chartWidth}px`;
            chartDiv.style.position = 'relative';
            
            console.log(`系统 ${systemIndex + 1}: 图表位置: ${chartStartX.toFixed(2)}px (基础: ${baseChartStartX.toFixed(2)}px, 偏移: ${chartOffsetX}px), 宽度: ${chartWidth.toFixed(2)}px`);
        } catch (error) {
            console.error(`系统 ${systemIndex + 1}: 对齐图表位置时出错:`, error);
        }
    }, 200); // 增加等待时间，确保SVG完全渲染
}

// 检测小节的实际渲染位置和宽度
function detectMeasurePositions(systemIndex) {
    const scoreDiv = document.getElementById(`score-${systemIndex}`);
    if (!scoreDiv) {
        console.warn(`系统 ${systemIndex} 的乐谱容器不存在`);
        return null;
    }
    
    const svg = scoreDiv.querySelector('svg');
    if (!svg) {
        console.warn(`系统 ${systemIndex} 的SVG不存在`);
        return null;
    }
    
    const system = systems[systemIndex];
    if (!system) {
        console.warn(`系统 ${systemIndex} 不存在`);
        return null;
    }
    
    // 获取所有小节的实际位置
    const measurePositions = [];
    
    try {
        // 方法1: 查找 measure number 文本元素，它们通常标记了小节的开始位置
        const measureNumberTexts = svg.querySelectorAll('text');
        const measureGroups = new Map();
        
        measureNumberTexts.forEach((textEl) => {
            const text = textEl.textContent.trim();
            const measureNum = parseInt(text);
            if (!isNaN(measureNum) && measureNum >= parseInt(system.startMeasure.getAttribute('number')) && 
                measureNum <= parseInt(system.endMeasure.getAttribute('number'))) {
                // 找到包含这个文本的 measure 组
                let current = textEl;
                let measureGroup = null;
                
                // 向上查找 measure 容器
                for (let i = 0; i < 10 && current && current !== svg; i++) {
                    const className = current.getAttribute('class') || '';
                    if (className.includes('measure') || className.includes('Measure')) {
                        measureGroup = current;
                        break;
                    }
                    current = current.parentElement;
                }
                
                if (measureGroup) {
                    try {
                        const bbox = measureGroup.getBBox();
                        if (!measureGroups.has(measureNum)) {
                            measureGroups.set(measureNum, {
                                measureNumber: measureNum,
                                x: bbox.x,
                                width: bbox.width,
                                element: measureGroup
                            });
                        }
                    } catch (e) {
                        // getBBox 可能失败，忽略
                    }
                }
            }
        });
        
        // 方法2: 如果方法1没找到足够的小节，尝试查找所有可能的 measure 容器
        if (measureGroups.size < system.measures.length) {
            const allGroups = svg.querySelectorAll('g');
            const startMeasureNum = parseInt(system.startMeasure.getAttribute('number'));
            
            allGroups.forEach((group, index) => {
                const className = group.getAttribute('class') || '';
                if ((className.includes('measure') || className.includes('Measure')) && 
                    index < system.measures.length) {
                    const measureNum = startMeasureNum + index;
                    if (!measureGroups.has(measureNum)) {
                        try {
                            const bbox = group.getBBox();
                            measureGroups.set(measureNum, {
                                measureNumber: measureNum,
                                x: bbox.x,
                                width: bbox.width,
                                element: group
                            });
                        } catch (e) {
                            // getBBox 可能失败，忽略
                        }
                    }
                }
            });
        }
        
        // 将 Map 转换为数组
        measureGroups.forEach((pos) => {
            measurePositions.push(pos);
        });
        
        // 如果仍然没有找到足够的小节，使用备用方法补充
        if (measurePositions.length < system.measures.length) {
            console.warn(`系统 ${systemIndex}: 只找到 ${measurePositions.length}/${system.measures.length} 个小节位置，使用估算方法补充`);
            
            // 使用 SVG 的总宽度和小节数量估算
            const svgBbox = svg.getBBox();
            const totalWidth = svgBbox.width;
            const numberOfMeasures = system.measures.length;
            
            // 如果有检测到的小节，使用它们的平均宽度；否则使用总宽度平均分配
            let avgMeasureWidth = totalWidth / numberOfMeasures;
            if (measurePositions.length > 0) {
                const avgDetectedWidth = measurePositions.reduce((sum, p) => sum + p.width, 0) / measurePositions.length;
                avgMeasureWidth = avgDetectedWidth || avgMeasureWidth;
            }
            
            // 为缺失的小节补充位置信息
            system.measures.forEach((measure, index) => {
                const measureNumber = parseInt(measure.getAttribute('number'));
                if (!measurePositions.find(p => p.measureNumber === measureNumber)) {
                    // 计算估算位置：如果有检测到的小节，使用它们的位置作为参考
                    let estimatedX = svgBbox.x + index * avgMeasureWidth;
                    if (measurePositions.length > 0) {
                        // 找到最接近的小节作为参考
                        const closestPos = measurePositions.reduce((closest, pos) => {
                            const closestDiff = Math.abs(closest.measureNumber - measureNumber);
                            const currentDiff = Math.abs(pos.measureNumber - measureNumber);
                            return currentDiff < closestDiff ? pos : closest;
                        });
                        const measureDiff = measureNumber - closestPos.measureNumber;
                        estimatedX = closestPos.x + measureDiff * avgMeasureWidth;
                    }
                    
                    measurePositions.push({
                        measureNumber: measureNumber,
                        x: estimatedX,
                        width: avgMeasureWidth
                    });
                }
            });
        }
        
        // 按小节号排序
        measurePositions.sort((a, b) => a.measureNumber - b.measureNumber);
        
        // 计算相对位置（相对于第一个小节）
        if (measurePositions.length > 0) {
            const firstMeasureX = measurePositions[0].x;
            measurePositions.forEach(pos => {
                pos.relativeX = pos.x - firstMeasureX;
            });
            
            // 验证所有小节都有位置信息
            const expectedMeasures = [];
            for (let m = parseInt(system.startMeasure.getAttribute('number')); 
                 m <= parseInt(system.endMeasure.getAttribute('number')); m++) {
                expectedMeasures.push(m);
            }
            const foundMeasures = measurePositions.map(p => p.measureNumber);
            const missing = expectedMeasures.filter(m => !foundMeasures.includes(m));
            if (missing.length > 0) {
                console.warn(`系统 ${systemIndex}: 仍然缺失小节位置: ${missing.join(', ')}`);
            } else {
                console.log(`系统 ${systemIndex}: 成功检测到所有 ${measurePositions.length} 个小节位置`);
            }
        }
        
    } catch (error) {
        console.error(`检测小节位置时出错:`, error);
        return null;
    }
    
    return measurePositions.length > 0 ? measurePositions : null;
}

// 渲染乐谱
async function renderScore(systemIndex) {
    const system = systems[systemIndex];
    const scoreDiv = document.getElementById(`score-${systemIndex}`);
    
    try {
        // 创建只包含当前系统的MusicXML
        const systemXml = createSystemXML(system);
        
        // 使用OpenSheetMusicDisplay渲染
        const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(scoreDiv, {
            backend: "svg",
            autoResize: true,
            drawTitle: false,
            drawPartNames: false,
            drawMeasureNumbers: true
        });
        
        
        await osmd.load(systemXml);
        osmd.render();
        
        // 等待渲染完成后检测小节位置
        return new Promise((resolve) => {
            setTimeout(() => {
                const measurePositions = detectMeasurePositions(systemIndex);
                // 存储小节位置信息
                window[`systemMeasurePositions_${systemIndex}`] = measurePositions;
                resolve(measurePositions);
            }, 1000);
        });
        
    } catch (error) {
        console.error(`渲染系统 ${systemIndex} 的乐谱时出错:`, error);
        scoreDiv.innerHTML = `<div style="color: red; padding: 10px;">乐谱渲染失败: ${error.message}<br><small>请查看控制台获取更多信息</small></div>`;
        return null;
    }
}

// 创建只包含当前系统的MusicXML
function createSystemXML(system) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(musicXmlData, 'text/xml');
    const serializer = new XMLSerializer();
    
    // 获取measure编号范围
    const measureNumbers = system.measures.map(m => parseInt(m.getAttribute('number')));
    const firstMeasureNum = Math.min(...measureNumbers);
    
    // 使用原始文档的implementation创建新文档
    const newDoc = xmlDoc.implementation.createDocument(null, 'score-partwise', null);
    const scorePartwise = newDoc.documentElement;
    scorePartwise.setAttribute('version', '2.0');
    
    // 复制work
    const work = xmlDoc.querySelector('work');
    if (work) {
        scorePartwise.appendChild(newDoc.importNode(work, true));
    }
    
    // 复制identification
    const identification = xmlDoc.querySelector('identification');
    if (identification) {
        scorePartwise.appendChild(newDoc.importNode(identification, true));
    }
    
    // 复制defaults
    const defaults = xmlDoc.querySelector('defaults');
    if (defaults) {
        scorePartwise.appendChild(newDoc.importNode(defaults, true));
    }
    
    // 复制part-list
    const partList = xmlDoc.querySelector('part-list');
    if (partList) {
        scorePartwise.appendChild(newDoc.importNode(partList, true));
    }
    
    // 为每个part创建新的part元素
    const parts = xmlDoc.querySelectorAll('part');
    parts.forEach(part => {
        const newPart = newDoc.createElement('part');
        newPart.setAttribute('id', part.getAttribute('id'));
        
        // 获取该part的原始第一个measure（用于获取attributes）
        const originalFirstMeasure = part.querySelector('measure');
        
        // 添加measures
        system.measures.forEach((measure, index) => {
            const measureNumber = measure.getAttribute('number');
            const measureInPart = part.querySelector(`measure[number="${measureNumber}"]`);
            
            if (measureInPart) {
                const measureClone = newDoc.importNode(measureInPart, true);
                
                // 如果是第一个measure，确保包含attributes
                if (index === 0) {
                    const hasAttributes = measureClone.querySelector('attributes');
                    if (!hasAttributes && originalFirstMeasure) {
                        const attributes = originalFirstMeasure.querySelector('attributes');
                        if (attributes) {
                            // 在第一个子节点前插入attributes
                            const attrsClone = newDoc.importNode(attributes, true);
                            if (measureClone.firstChild) {
                                measureClone.insertBefore(attrsClone, measureClone.firstChild);
                            } else {
                                measureClone.appendChild(attrsClone);
                            }
                        }
                    }
                } else {
                    // 移除后续measure的attributes（避免重复）
                    const attrs = measureClone.querySelector('attributes');
                    if (attrs) {
                        attrs.remove();
                    }
                }
                
                newPart.appendChild(measureClone);
            }
        });
        
        scorePartwise.appendChild(newPart);
    });
    
    // 转换为字符串，添加XML声明和DOCTYPE
    let xmlString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
    xmlString += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 2.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n';
    xmlString += serializer.serializeToString(newDoc);
    
    return xmlString;
}

// 添加贯穿整行的竖线（从图表出发，上下贯穿整个系统）
function addFullHeightMinimaLines(systemIndex) {
    const systemRow = document.getElementById(`system-${systemIndex}`);
    if (!systemRow) return;
    
    // 清除之前可能存在的竖线
    const existingLines = systemRow.querySelectorAll('.minima-line-full');
    existingLines.forEach(line => line.remove());
    
    // 如果未启用显示，直接返回
    if (!showMinimaLines) return;
    
    const systemMinima = window[`systemMinima_${systemIndex}`] || [];
    const scoreDiv = document.getElementById(`score-${systemIndex}`);
    const chartDiv = document.getElementById(`chart-${systemIndex}`);
    
    if (!scoreDiv || !chartDiv || systemMinima.length === 0) return;
    
    // 获取图表canvas和Chart实例
    const canvas = chartDiv.querySelector('canvas');
    if (!canvas) return;
    
    const chartInstance = Chart.getChart(canvas);
    if (!chartInstance) return;
    
    const chartArea = chartInstance.chartArea;
    const systemRowRect = systemRow.getBoundingClientRect();
    const chartDivRect = chartDiv.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    systemMinima.forEach(minima => {
        // pixelX是相对于chartArea的x坐标（从chartArea.left开始）
        // 需要转换为相对于systemRow的绝对位置
        if (minima.pixelX === undefined || minima.pixelX === null) {
            return;
        }
        
        // 1. pixelX是相对于chartArea的，需要加上chartArea.left得到相对于canvas的位置
        const canvasRelativeX = minima.pixelX + chartArea.left;
        
        // 2. 计算canvas在页面中的绝对位置
        const canvasAbsoluteX = canvasRect.left;
        
        // 3. 计算竖线在页面中的绝对x位置
        const absoluteX = canvasAbsoluteX + canvasRelativeX;
        
        // 4. 计算相对于systemRow的位置
        const relativeX = absoluteX - systemRowRect.left;
        
        // 5. 转换为百分比
        const xPosPercent = (relativeX / systemRowRect.width) * 100;
        
        if (xPosPercent < -5 || xPosPercent > 105) {
            return;
        }
        
        // 创建贯穿整行的竖线
        const line = document.createElement('div');
        line.className = 'minima-line-full';
        line.style.left = `${xPosPercent}%`;
        // 显示用的index（从1开始）
        const displayIndex = minima.displayIndex !== undefined ? minima.displayIndex : minima.index + 1;
        line.setAttribute('data-index', displayIndex);
        line.setAttribute('data-energy', minima.tempo.toFixed(4));
        
        // 添加标签（在图表上方）
        const labelTop = document.createElement('div');
        labelTop.className = 'minima-label';
        labelTop.textContent = `Index: ${displayIndex} | Energy: ${minima.tempo.toFixed(4)}`;
        line.appendChild(labelTop);
        
        // 添加标签（在乐谱下方）
        const labelBottom = document.createElement('div');
        labelBottom.className = 'minima-label-score';
        labelBottom.textContent = `${minima.tempo.toFixed(4)}`;
        line.appendChild(labelBottom);
        
        systemRow.appendChild(line);
    });
}

// 在乐谱上添加最小值标记（已移除，因为竖线从图表出发贯穿整个系统）
function addMinimaMarkersToScore(systemIndex, scoreDiv) {
    // 不再在乐谱SVG上单独添加标记，竖线会从图表出发贯穿整个系统
    // 保留函数以防将来需要
}

// 渲染折线图
function renderChart(systemIndex, globalMaxX = null, measurePositions = null) {
    const system = systems[systemIndex];
    const chartDiv = document.getElementById(`chart-${systemIndex}`);
    if (!chartDiv) {
        console.warn(`系统 ${systemIndex} 的图表容器不存在`);
        return;
    }
    
    // 清除之前的图表实例（如果存在）
    const existingCanvas = chartDiv.querySelector('canvas');
    if (existingCanvas) {
        const existingChart = Chart.getChart(existingCanvas);
        if (existingChart) {
            existingChart.destroy();
        }
    }
    
    const startMeasure = parseInt(system.startMeasure.getAttribute('number'));
    const endMeasure = parseInt(system.endMeasure.getAttribute('number'));
    
    // 获取拍号信息
    if (!timeSignature) {
        timeSignature = getTimeSignature();
    }
    const beatsPerMeasure = timeSignature.beats;
    
    // 确保从配置对象读取最新的leadingSpacing值（确保应用到所有子系统）
    // 每次渲染时都重新读取，避免使用缓存值
    if (!ChartConfig || typeof ChartConfig.leadingSpacing === 'undefined') {
        console.warn('ChartConfig.leadingSpacing未定义，使用默认值0.40');
    }
    
    // 直接使用系统的小节数量（更准确）
    const numberOfMeasures = system.measures.length;
    
    // 计算应该渲染的beat数量：拍号 × 小节数
    const expectedBeats = beatsPerMeasure * numberOfMeasures;
    
    // 计算起始和结束的index范围
    const startIndex = (startMeasure - 1) * beatsPerMeasure;
    const endIndex = startIndex + expectedBeats - 1;
    
    // 调试信息
    console.log(`系统 ${systemIndex + 1}: 小节 ${startMeasure}-${endMeasure}, 小节数=${numberOfMeasures}, beatsPerMeasure=${beatsPerMeasure}, expectedBeats=${expectedBeats}, index范围=${startIndex}-${endIndex}`);
    
    
    // 筛选属于当前系统的数据
    const systemData = [];
    const systemLabels = [];
    const systemMinima = [];
    
    // 创建index到数据的映射，方便查找
    const dataMap = new Map();
    tempoData.forEach((row) => {
        const index = parseInt(row.index);
        dataMap.set(index, row);
    });
    
    // 遍历所有应该渲染的beat（从startIndex到endIndex，包含endIndex）
    // 应该正好有 expectedBeats 个beat
    let filteredCount = 0;
    for (let index = startIndex; index <= endIndex; index++) {
        const row = dataMap.get(index);
        const pos = indexToMeasure(index);
        
        // 验证：计算出的measureNumber应该在系统的小节范围内
        // 但由于我们使用的是 system.measures.length，应该所有index都在范围内
        if (pos.measureNumber < startMeasure || pos.measureNumber > endMeasure) {
            console.warn(`系统 ${systemIndex + 1}: index ${index} 对应的小节 ${pos.measureNumber} 不在系统范围内 [${startMeasure}-${endMeasure}]`);
            filteredCount++;
            continue;
        }
        
        // 如果数据中存在这个index，使用实际数据
        if (row) {
            systemData.push({
                x: index,
                y: parseFloat(row.tempo),
                measureNumber: pos.measureNumber,
                positionInMeasure: pos.positionInMeasure,
                index: index
            });
            
            // 只在 is_local_minima === '1' 的地方标记最小值
            if (row.is_local_minima === '1') {
                systemMinima.push({
                    index: index,  // 保持原始index用于数据查找
                    displayIndex: index + 1,  // 显示用的index（从1开始）
                    tempo: parseFloat(row.tempo),
                    measureNumber: pos.measureNumber,
                    positionInMeasure: pos.positionInMeasure
                });
            }
        } else {
            // 如果数据中不存在，使用前一个数据点的值（或null）
            // 这样可以保持图表的连续性
            const prevData = systemData.length > 0 ? systemData[systemData.length - 1] : null;
            systemData.push({
                x: index,
                y: prevData ? prevData.y : null,
                measureNumber: pos.measureNumber,
                positionInMeasure: pos.positionInMeasure,
                index: index
            });
        }
        
        // X轴标签显示 index_beat（1, 2, 3...），显示时+1因为CSV的index从0开始
        systemLabels.push(`${index + 1}`);
    }
    
    // 验证数据点数量
    if (systemData.length !== expectedBeats) {
        console.warn(`系统 ${systemIndex + 1}: 数据点数量不匹配！期望 ${expectedBeats} 个，实际 ${systemData.length} 个，过滤掉 ${filteredCount} 个`);
    }
    
    
    if (systemData.length === 0) {
        chartDiv.innerHTML = '<div>暂无数据</div>';
        return;
    }
    
    // 获取配置参数（确保每次渲染都从ChartConfig读取最新值，应用到所有子系统）
    const measureSpacing = ChartConfig.measureSpacing;
    const beatSpacing = ChartConfig.beatSpacing;
    // 开头空余大小参数，确保应用到所有子系统
    // 每次渲染时都从ChartConfig读取最新值，不使用缓存
    let leadingSpacing = ChartConfig.leadingSpacing;
    
    // 验证leadingSpacing参数是否存在和有效
    if (typeof leadingSpacing !== 'number' || leadingSpacing < 0) {
        console.warn(`系统 ${systemIndex + 1}: leadingSpacing参数无效，使用默认值0.40`);
        leadingSpacing = 0.40;
    }
    
    // 计算每个数据点的x位置（考虑measureSpacing和beatSpacing）
    // 使用对象格式 {x, y} 来指定自定义x坐标
    const chartDataPoints = [];
    const chartLabels = [];
    
    // 计算开头空余的宽度（使用leadingSpacing参数调整，确保应用到所有子系统）
    // leadingSpacing表示多少个beat的宽度，所以只需要乘以beatSpacing
    // 不乘以beatsPerMeasure，确保所有系统的开头空白长度一致
    const leadingWidth = leadingSpacing * beatSpacing;
    
    // 第一个数据点在x=0位置，y值应该是null（因为渲染乐谱的时候第一段会空一点）
    // 这样图表就会从第二个beat开始显示，与乐谱的空余部分对齐
    chartDataPoints.push({ x: 0, y: null });
    chartLabels.push(''); // 空节拍位置不显示标签
    
    // 如果有小节位置信息，使用实际位置对齐；否则使用固定间距
    const useActualPositions = measurePositions && measurePositions.length > 0;
    
    if (useActualPositions) {
        // 创建小节号到位置的映射
        const measurePosMap = new Map();
        measurePositions.forEach(pos => {
            measurePosMap.set(pos.measureNumber, pos);
        });
        
        // 验证是否所有小节都有位置信息
        const missingMeasures = [];
        for (let m = startMeasure; m <= endMeasure; m++) {
            if (!measurePosMap.has(m)) {
                missingMeasures.push(m);
            }
        }
        
        // 如果有缺失的小节，使用估算方法补充
        if (missingMeasures.length > 0) {
            console.warn(`系统 ${systemIndex + 1}: 缺失 ${missingMeasures.length} 个小节的位置信息，使用估算方法补充`);
            
            // 获取SVG总宽度
            const scoreDiv = document.getElementById(`score-${systemIndex}`);
            const svg = scoreDiv ? scoreDiv.querySelector('svg') : null;
            if (svg) {
                try {
                    const svgBbox = svg.getBBox();
                    const totalWidth = svgBbox.width;
                    const avgMeasureWidth = totalWidth / numberOfMeasures;
                    
                    // 如果有检测到的小节，使用它们的平均宽度
                    if (measurePositions.length > 0) {
                        const avgDetectedWidth = measurePositions.reduce((sum, p) => sum + p.width, 0) / measurePositions.length;
                        const estimatedWidth = avgDetectedWidth || avgMeasureWidth;
                        
                        // 为缺失的小节估算位置
                        missingMeasures.forEach((measureNum) => {
                            const measureIndex = measureNum - startMeasure;
                            // 使用第一个小节的位置作为参考
                            const firstMeasurePos = measurePositions[0];
                            if (firstMeasurePos) {
                                measurePosMap.set(measureNum, {
                                    measureNumber: measureNum,
                                    x: firstMeasurePos.x + measureIndex * estimatedWidth,
                                    width: estimatedWidth,
                                    relativeX: firstMeasurePos.relativeX + measureIndex * estimatedWidth
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.error('估算小节位置时出错:', e);
                }
            }
        }
        
        // 重新计算相对位置（确保所有小节都有relativeX）
        const sortedMeasures = Array.from(measurePosMap.values()).sort((a, b) => a.measureNumber - b.measureNumber);
        if (sortedMeasures.length > 0) {
            const firstMeasureX = sortedMeasures[0].x;
            sortedMeasures.forEach(pos => {
                if (pos.relativeX === undefined) {
                    pos.relativeX = pos.x - firstMeasureX;
                }
            });
        }
        
        // 计算乐谱的总相对宽度（从第一个小节开始到最后一个小节结束）
        const firstMeasurePos = sortedMeasures[0];
        const lastMeasurePos = sortedMeasures[sortedMeasures.length - 1];
        const totalScoreRelativeWidth = lastMeasurePos ? (lastMeasurePos.relativeX + lastMeasurePos.width) : 0;
        
        // 计算基础缩放比例：将乐谱的相对宽度映射到基础beat宽度
        // 基础宽度：所有beat的宽度（不考虑measureSpacing）
        const numberOfBeats = systemData.length;
        const baseWidth = numberOfBeats * beatSpacing;
        const baseScaleFactor = totalScoreRelativeWidth > 0 ? baseWidth / totalScoreRelativeWidth : 1;
        
        // 遍历所有数据点，根据小节的实际位置计算x坐标
        systemData.forEach((dataPoint) => {
            const beatIndexInSystem = dataPoint.index - startIndex;
            const beatInMeasure = beatIndexInSystem % beatsPerMeasure;
            const actualMeasureNumber = dataPoint.measureNumber;
            
            // 查找对应小节的位置信息（现在应该所有小节都有了）
            const measurePos = measurePosMap.get(actualMeasureNumber);
            
            if (measurePos && measurePos.relativeX !== undefined) {
                // 计算beat在小节内的相对位置（0-1）
                const beatPositionInMeasure = beatInMeasure / beatsPerMeasure;
                
                // 计算beat在小节内的相对x坐标（相对于第一个小节）
                const beatRelativeX = measurePos.relativeX + (beatPositionInMeasure * measurePos.width);
                
                // 计算当前beat所在的小节索引（从0开始）
                const measureIndex = Math.floor(beatIndexInSystem / beatsPerMeasure);
                
                // 将乐谱的相对坐标转换为图表的坐标空间（使用基础缩放比例）
                const scaledX = beatRelativeX * baseScaleFactor;
                
                // 应用measureSpacing：每个小节后添加额外间距
                // 计算已经完成的小节数（用于添加小节之间的额外间距）
                const completedMeasures = measureIndex; // 当前小节之前完成的小节数
                const extraMeasureSpacing = completedMeasures * (measureSpacing - 1) * beatsPerMeasure * beatSpacing;
                
                // 最终x坐标 = 开头空白 + 缩放后的位置 + 小节额外间距
                const x = leadingWidth + scaledX + extraMeasureSpacing;
                
                chartDataPoints.push({ x: x, y: dataPoint.y });
            } else {
                // 如果仍然找不到小节位置，使用备用计算方法（这种情况应该很少）
                console.warn(`系统 ${systemIndex + 1}: 小节 ${actualMeasureNumber} 位置信息缺失，使用备用方法`);
                const completedMeasures = Math.floor(beatIndexInSystem / beatsPerMeasure);
                const extraMeasureSpacing = completedMeasures * (measureSpacing - 1) * beatsPerMeasure * beatSpacing;
                const x = leadingWidth + beatIndexInSystem * beatSpacing + extraMeasureSpacing;
                chartDataPoints.push({ x: x, y: dataPoint.y });
            }
            
            // x轴标签始终显示beat的index
            chartLabels.push(`${dataPoint.index + 1}`);
        });
    } else {
        // 使用固定间距计算（原有逻辑）
        systemData.forEach((dataPoint) => {
            // 使用全局beat索引直接计算位置，确保与横坐标标签对齐
            // dataPoint.index 是全局beat索引（从整个乐曲开始）
            // startIndex 是当前系统开始的全局beat索引
            const beatIndexInSystem = dataPoint.index - startIndex;
            
            // 计算已经完成的小节数（用于添加小节之间的额外间距）
            const completedMeasures = Math.floor(beatIndexInSystem / beatsPerMeasure);
            
            // 计算x坐标：
            // - 开头空余占用的宽度：leadingWidth
            // - beat在系统中的位置 * beat间距：beatIndexInSystem * beatSpacing
            // - 小节之间的额外间距：每个小节后添加 (measureSpacing - 1) * beatsPerMeasure * beatSpacing 的额外空间
            const extraMeasureSpacing = completedMeasures * (measureSpacing - 1) * beatsPerMeasure * beatSpacing;
            
            // x坐标 = 开头空余 + beat位置 * beat间距 + 小节额外间距
            const x = leadingWidth + beatIndexInSystem * beatSpacing + extraMeasureSpacing;
            
            chartDataPoints.push({ x: x, y: dataPoint.y });
            // x轴标签始终显示beat的index
            chartLabels.push(`${dataPoint.index + 1}`);
        });
    }
    
    // 计算当前系统的实际x轴范围（从第一个beat到最后一个beat）
    // 注意：第一个点（x=0）是空节拍位置，需要包含在范围内以显示开头的空白
    let systemMinX = 0; // 始终从0开始，包含开头的空白
    let systemMaxX = 0;
    
    if (chartDataPoints.length > 0) {
        // 找到最后一个实际数据点（用于确定x轴的最大值）
        const lastDataPoint = chartDataPoints.slice().reverse().find((d, idx) => d && d.y !== null);
        
        if (lastDataPoint) {
            // 最小值始终是0（包含开头的空白），最大值是最后一个数据点的x值
            systemMinX = 0;
            systemMaxX = lastDataPoint.x;
        } else if (chartDataPoints.length > 1) {
            // 如果没有有效数据点，使用所有数据点的x范围
            const allPoints = chartDataPoints.filter((d, idx) => d && d.x !== undefined);
            if (allPoints.length > 0) {
                systemMinX = 0; // 始终从0开始
                systemMaxX = Math.max(...allPoints.map(d => d.x));
            }
        }
    }
    
    // 如果计算出的范围无效，使用默认值
    if (systemMaxX <= systemMinX) {
        systemMinX = 0;
        systemMaxX = systemMaxX || 100; // 默认值
    }
    
    console.log(`系统 ${systemIndex + 1}: x轴范围从 ${systemMinX.toFixed(2)} 到 ${systemMaxX.toFixed(2)}`);
    
    // 清除之前的内容
    chartDiv.innerHTML = '';
    
    // 创建canvas用于绘制
    const canvas = document.createElement('canvas');
    chartDiv.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // 设置canvas大小
    canvas.width = chartDiv.offsetWidth;
    canvas.height = chartDiv.offsetHeight;
    
    // 创建Chart.js图表
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Energy',
                data: chartDataPoints,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                pointRadius: 0,
                spanGaps: true  // 允许跨越null值
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 0, // 左边距设为0，因为我们使用leadingWidth来控制空白
                    right: 0,
                    top: 0,
                    bottom: 0
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataIndex = context.dataIndex;
                            // 第一个点（x=0位置）是空节拍位置，不显示tooltip
                            if (dataIndex === 0) {
                                return null;
                            }
                            // 实际数据索引需要-1（因为第一个点是空节拍位置）
                            const actualIndex = dataIndex - 1;
                            const dataPoint = systemData[actualIndex];
                            if (dataPoint && dataPoint.y !== null) {
                                // 显示时+1，因为CSV的index从0开始，但显示应该从1开始
                                return `Energy: ${dataPoint.y.toFixed(4)} | Index_Beat: ${dataPoint.index + 1}`;
                            }
                            return null;
                        },
                        filter: function(tooltipItem) {
                            // 过滤掉第一个空节拍位置和null值的tooltip
                            if (tooltipItem.dataIndex === 0) return false;
                            const dataPoint = chartDataPoints[tooltipItem.dataIndex];
                            return dataPoint && dataPoint.y !== null;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Energy'
                    }
                },
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Index_Beat'
                    },
                    min: systemMinX, // 从第一个beat开始显示
                    max: systemMaxX, // 到最后一个beat结束显示
                    offset: false, // 不自动添加偏移
                    afterBuildTicks: function(scale) {
                        // 手动设置tick位置，使其正好在数据点的x坐标上
                        // 这样标签位置和数据点位置完全对齐
                        const ticks = [];
                        chartDataPoints.forEach((d, idx) => {
                            // 跳过第一个点（x=0的空节拍位置）和y为null的点
                            if (idx > 0 && d && d.y !== null && d.x > 0) {
                                ticks.push({
                                    value: d.x,
                                    label: chartLabels[idx] || ''
                                });
                            }
                        });
                        scale.ticks = ticks;
                    },
                    ticks: {
                        callback: function(value) {
                            // 找到对应的数据点索引
                            const dataIndex = chartDataPoints.findIndex((d, idx) => 
                                idx > 0 && d && Math.abs(d.x - value) < 0.001
                            );
                            
                            if (dataIndex >= 0 && dataIndex < chartLabels.length) {
                                return chartLabels[dataIndex] || '';
                            }
                            return '';
                        }
                    }
                }
            }
        },
        // 移除图表内部的竖线绘制，竖线将从外部贯穿整个系统
    });
    
    // 存储最小值位置信息，用于后续绘制贯穿竖线
    // 等待图表渲染完成后计算准确位置
    setTimeout(() => {
        const chartInstance = Chart.getChart(canvas);
        if (!chartInstance) return;
        
        const xScale = chartInstance.scales.x;
        const chartArea = chartInstance.chartArea;
        
        // 计算相邻数据点之间的距离（用于向左偏移）
        // 使用实际的x坐标值来计算
        let beatWidth = 0;
        if (chartDataPoints.length > 2) {
            // 找到第一个和第二个实际数据点（跳过第一个空数据点）
            const firstDataPoint = chartDataPoints[1];
            const secondDataPoint = chartDataPoints[2];
            if (firstDataPoint && secondDataPoint) {
                const firstPixelX = xScale.getPixelForValue(firstDataPoint.x);
                const secondPixelX = xScale.getPixelForValue(secondDataPoint.x);
                beatWidth = secondPixelX - firstPixelX;
            }
        }
        
        window[`systemMinima_${systemIndex}`] = systemMinima.map(minima => {
            // 找到对应的数据点（在systemData数组中的位置）
            const dataIndexInSystemData = systemData.findIndex(d => d.index === minima.index);
            if (dataIndexInSystemData !== -1 && xScale) {
                // 由于前面添加了空数据点，Chart.js中的索引需要+1
                const chartDataIndex = dataIndexInSystemData + 1;
                
                // 获取对应的数据点的x坐标
                const dataPoint = chartDataPoints[chartDataIndex];
                if (!dataPoint) return null;
                
                // 使用Chart.js的实际x位置（基于x坐标值）
                let pixelX = xScale.getPixelForValue(dataPoint.x);
                
                // 向左偏移一个beat的位置（使用统一的偏移函数）
                if (beatWidth > 0 && chartDataIndex > 1) {
                    const offsetScale = getLineOffsetScale();
                    pixelX = pixelX - offsetScale * beatWidth;
                }
                
                return {
                    ...minima,
                    pixelX: pixelX,
                    dataIndex: chartDataIndex,  // Chart.js中的索引
                    originalDataIndex: dataIndexInSystemData,  // systemData中的原始索引
                    chartAreaLeft: chartArea.left,
                    beatWidth: beatWidth
                };
            }
            return null;
        }).filter(m => m !== null);
        
        // 触发贯穿竖线的绘制
        addFullHeightMinimaLines(systemIndex);
    }, 300);
}

// 将函数暴露到全局作用域
window.addFullHeightMinimaLines = addFullHeightMinimaLines;
window.loadAndRenderLevel = loadAndRenderLevel;

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);

