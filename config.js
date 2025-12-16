// ==================== 图表参数配置（统一调整位置） ====================
// 所有偏移和缩放参数都在这里，方便统一调整
// 修改下面的值来调整图表显示效果

const ChartConfig = {
    // 图表左右移动距离（像素，正数向右移动，负数向左移动）
    // 用于微调图表相对于乐谱的位置
    chartOffsetX: -85,
    
    // 竖线向左偏移倍数（0-2.0，1.0表示偏移1个beat宽度）
    lineOffsetScale: 1.0,
    
    // 小节之间的坐标距离（用于调整图表中小节之间的间距）
    // 值越大，小节之间距离越大，默认1.0
    measureSpacing: 1.05,
    
    // 小节内部beat距离（用于调整一个小节内各个beat之间的间距）
    // 值越大，beat之间距离越大，默认1.0
    beatSpacing: 1.0,
    
    // 开头空余地方的大小（用于调整图表开头空节拍的宽度）
    // 值越大，开头空余越大，默认1.0（表示1个beat的宽度）
    leadingSpacing: 1.3,
    
    // 每个小节占用的最小宽度（像素），用于计算每个系统显示多少个小节
    // 值越小，每个系统显示的小节越多
    // 系统会根据窗口宽度自动计算：measuresPerSystem = floor(窗口宽度 / minMeasureWidth)
    minMeasureWidth: 200,
    
    // 应用配置到CSS变量
    apply() {
        // chartOffsetX 不设置CSS变量，直接在JavaScript中使用
        document.documentElement.style.setProperty('--line-offset-scale', this.lineOffsetScale);
        document.documentElement.style.setProperty('--measure-spacing', this.measureSpacing);
        document.documentElement.style.setProperty('--beat-spacing', this.beatSpacing);
        document.documentElement.style.setProperty('--leading-spacing', this.leadingSpacing);
    },
    
    // 从CSS变量读取配置（用于初始化，但config.js的值优先）
    // 注意：修改config.js后，直接刷新页面即可，不需要调用load()
    load() {
        // 不再从CSS变量读取，直接使用config.js中的值
        // 这样可以确保config.js的修改立即生效
    }
};

// 将配置对象暴露到全局作用域
window.ChartConfig = ChartConfig;

