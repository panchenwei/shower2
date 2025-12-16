# 乐谱与折线图对齐平台

这是一个用于将MusicXML乐谱与CSV折线图数据对齐显示的网页平台。主要功能是：

1. **按系统（System）分组显示**：每行显示一个乐谱系统（system）和对应的折线图
2. **局部最小值标注**：在折线图的局部最小值处标注数据，并用竖线贯穿整行（乐谱+折线图）
3. **精确对齐**：通过解析MusicXML的measure信息和CSV的index数据，实现乐谱与折线图的精确对齐

## 解决方案要点

### 1. 系统（System）识别
- 通过解析MusicXML中的 `<print new-system="yes"/>` 标记来识别每个系统（行）
- 每个系统包含多个measure（小节）
- 按系统分组渲染，确保每行独立显示

### 2. 数据对齐
- CSV数据中的 `index` 字段对应节拍位置
- 通过 `indexToMeasure()` 函数将index转换为measure编号和measure内的位置
- 假设每个measure有3个beat（3/4拍），可以根据实际MusicXML调整

### 3. 竖线贯穿
- 使用Chart.js渲染折线图，并在 `afterDraw` 钩子中绘制图表内的竖线
- 使用绝对定位的div元素创建贯穿整行的竖线（`.minima-line-full`）
- 通过Chart.js的API获取实际渲染位置，确保竖线位置准确

### 4. 乐谱渲染
- 使用OpenSheetMusicDisplay库渲染MusicXML
- 为每个系统创建独立的MusicXML片段进行渲染
- 在SVG上叠加最小值标记线

## 文件结构

```
platform/
├── index.html          # 主HTML文件
├── main.js             # 主要JavaScript逻辑
├── music.xml           # MusicXML格式的乐谱文件
└── Player_1/           # 折线图数据文件夹
    ├── mazurka174_Player_1_tempo_with_minima.csv  # 主要数据文件（包含tempo和最小值标记）
    ├── mazurka174_Player_1_minima_levels.csv     # 最小值层级信息
    └── ...其他CSV文件
```

## 使用方法

### 本地运行

1. 确保所有文件在同一目录下
2. 使用本地服务器打开 `index.html`（由于CORS限制，不能直接用file://协议打开）
   ```bash
   # 使用Python
   python -m http.server 8000
   
   # 或使用Node.js
   npx http-server
   ```
3. 在浏览器中访问 `http://localhost:8000`

### 部署到GitHub Pages

1. 将代码推送到GitHub仓库
2. 在仓库设置中：
   - 进入 Settings → Pages
   - Source 选择 "GitHub Actions"
3. 推送代码到 main/master 分支后，GitHub Actions会自动部署
4. 部署完成后，访问 `https://你的用户名.github.io/仓库名/`

## 关键技术

- **OpenSheetMusicDisplay**: 用于渲染MusicXML乐谱
- **Chart.js**: 用于绘制折线图
- **DOMParser**: 用于解析XML和提取系统信息
- **CSS绝对定位**: 用于创建贯穿整行的竖线

## 注意事项

1. **对齐精度**：当前实现假设每个measure有3个beat。如果实际节拍不同，需要调整 `indexToMeasure()` 函数
2. **系统识别**：依赖MusicXML中的 `new-system` 标记。如果标记不完整，可能需要手动调整
3. **浏览器兼容性**：需要支持ES6+的现代浏览器

## 未来改进方向

1. 支持自定义节拍映射
2. 支持缩放和平移
3. 支持导出为PDF或图片
4. 改进对齐算法，考虑实际的measure duration

