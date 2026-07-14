# 地图基础概念

在 GIS（地理信息系统）和思极地图开发中，理解基础概念是使用地图 SDK 的前提。本章介绍坐标系、瓦片图、矢量图和图层等核心概念。

## 坐标系

坐标系是描述地球上位置的空间参考系统。不同的坐标系适用于不同的使用场景。

### WGS84（GPS 坐标系）

- **全称**：World Geodetic System 1984
- **特点**：全球通用，GPS 设备采集的原始数据通常基于此坐标系
- **使用场景**：GPS 定位、国际标准
- **示例坐标**：`[116.397428, 39.90923]`（天安门）

### GCJ-02（火星坐标系）

- **来源**：由中国国家测绘局制定
- **特点**：在 WGS84 基础上进行了非线性偏移加密
- **使用场景**：国内地图服务（高德、腾讯等）
- **说明**：中国法规要求所有在国内发布的电子地图必须使用 GCJ-02 坐标系

### BD-09（百度坐标系）

- **来源**：百度地图在 GCJ-02 基础上二次加密
- **特点**：仅百度地图使用
- **注意**：与其他坐标系转换复杂

### 思极地图的坐标处理

思极地图 SDK 内置了坐标转换能力，可通过 `SGMap.ConvertTask` 插件进行不同坐标系间的转换：

```javascript
// 加载坐标转换插件
SGMap.plugin(['SGMap.ConvertTask']).then(() => {
  const convertTask = new SGMap.ConvertTask()
  // 将 WGS84 坐标转为 GCJ-02
  convertTask.wgs84ToGcj02([116.397428, 39.90923], (result) => {
    console.log('转换后坐标:', result)
  })
})
```

::: tip 坐标格式注意
思极地图中使用坐标时，格式统一为 `[经度(lng), 纬度(lat)]`，如 `[116.397428, 39.90923]`。注意经度在前，纬度在后，GeoJSON 规范同样遵循此顺序。
:::

## 瓦片图

瓦片图（Tile Map）是 Web 地图最基础的渲染技术。

### 什么是瓦片图

瓦片图将整个地图切割成一个个正方形的「瓦片」（通常为 256×256 像素），浏览器只需要加载当前视口范围内的瓦片即可显示地图，而不需要加载完整的地图数据。

### 瓦片金字塔模型

```
缩放级别 Zoom 0：  1 张瓦片（覆盖全球）
缩放级别 Zoom 1：  4 张瓦片（2×2）
缩放级别 Zoom 2：  16 张瓦片（4×4）
...
缩放级别 Zoom n：  4ⁿ 张瓦片
```

- **低缩放级别**：看到的是世界地图、国家级别
- **高缩放级别**：看到的是街道级别、建筑物级别
- **思极地图支持的缩放级别**：通常 0 ~ 24 级（影像图可达更高级别）

### 瓦片图的优缺点

| 优点 | 缺点 |
|------|------|
| 加载速度快，只需加载可见范围 | 放大时可能出现模糊（需等待新瓦片加载） |
| 适合大范围、高并发场景 | 样式固定，难以动态修改（需要重新切片） |
| 服务器压力小，支持 CDN 缓存 | 无法做复杂的交互效果 |

### 思极地图的瓦片底图样式

思极地图提供了多种预置的底图样式（矢量瓦片），通过 `style` 参数指定：

| 样式 ID | 说明 |
|---------|------|
| `aegis://styles/aegis/Streets-v2` | 街道地图（默认推荐） |
| `aegis://styles/aegis/Satellite` | 卫星影像图 |
| `aegis://styles/aegis/Satellite512` | 高分辨率卫星影像图（512px 瓦片） |

## 矢量图

矢量图（Vector Map）使用几何数据（点、线、面）来描述地图要素，是思极地图实现动态可视化交互的基础。

### 矢量图 vs 瓦片图

| 特性 | 瓦片图 | 矢量图 |
|------|--------|--------|
| 数据格式 | 图片（PNG/JPEG） | 几何数据（GeoJSON） |
| 缩放表现 | 需要加载新瓦片，过渡可能模糊 | 实时渲染，无级缩放不模糊 |
| 样式修改 | 无法动态修改 | 可任意动态修改颜色、透明度等 |
| 交互能力 | 无法单独操作要素 | 可查询、高亮、点击每一个要素 |
| 性能 | 好（图片传输） | 取决于数据量和渲染复杂度 |

### GeoJSON — 矢量数据的通用格式

GeoJSON 是一种基于 JSON 的地理空间数据交换格式，思极地图的矢量数据均使用 GeoJSON 格式：

```javascript
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "1001",                         // 唯一标识（纯数字或纯字符串）
      "geometry": {
        "type": "Point",                    // 几何类型：Point / LineString / Polygon / MultiPolygon
        "coordinates": [116.397428, 39.90923]  // 坐标 [经度, 纬度]
      },
      "properties": {                        // 业务属性（自定义）
        "name": "天安门",
        "color": "#009B83",
        "opacity": 0.8
      }
    }
  ]
}
```

::: warning Feature ID 要求
每个 Feature 的 `id` 必须是 **纯数字或纯字符串**，不支持字母数字混合（如 `"person_123"` 无效）。这是因为思极地图底层的 `setFeatureState` 需要通过 `id` 精确匹配要素，混合格式会导致匹配失败。
:::

**GeoJSON 的几何类型**：

| 类型 | 说明 | 坐标示例 |
|------|------|----------|
| `Point` | 点 | `[116.39, 39.90]` |
| `LineString` | 线（路径） | `[[116.39, 39.90], [116.40, 39.91]]` |
| `Polygon` | 面（区域） | `[[[116.3, 39.8], [116.5, 39.8], [116.5, 40.0], [116.3, 40.0], [116.3, 39.8]]]` |
| `MultiPolygon` | 多面（含孔洞或分离面） | 多个 Polygon 坐标数组 |

## 图层

图层（Layer）是思极地图中最核心的渲染概念。每个图层负责渲染一种类型的可视化效果。

### 图层的层级概念

地图由多个图层叠加而成，类似 Photoshop 的图层概念：

```
┌─────────────────────┐
│   弹窗 / Popup       │  ← 最上层
├─────────────────────┤
│   标记点层 (symbol)   │
├─────────────────────┤
│   边界线层 (line)     │
├─────────────────────┤
│   区域填充层 (fill)    │
├─────────────────────┤
│   路网层 (RoadNet)    │
├─────────────────────┤
│   底图层 (background) │  ← 最下层
└─────────────────────┘
```

图层的渲染顺序由添加顺序决定：**先添加的在底层，后添加的在顶层**。

### 图层类型

思极地图支持以下主要图层类型：

| 类型 | 对应几何 | 适用场景 | 示例 |
|------|----------|----------|------|
| `fill` | Polygon（面） | 区域填充（行政区划、责任区等） | 省/市/区县色彩填充 |
| `line` | LineString（线） | 边界、路径、路线 | 行政边界线、人员轨迹 |
| `circle` | Point（点） | 圆点标记 | 设备点位、人员位置 |
| `symbol` | Point（点） | 图标、文字标记 | 人员头像、工单图标 |
| `background` | — | 背景蒙层 | 深色半透明蒙层 |

### 图层创建流程

创建一个图层需要遵循以下模式：

```
1. 准备数据源 (addSource) → 2. 添加图层 (addLayer) → 3. 绑定交互事件 → 4. 更新数据 (setData) → 5. 销毁 (removeLayer + removeSource)
```

**基本示例**：

```javascript
// 1. 添加数据源
map.addSource('mySource', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: []
  },
  generateId: true  // 自动生成 Feature ID
})

// 2. 添加图层
map.addLayer({
  id: 'myLayer',
  type: 'fill',
  source: 'mySource',
  paint: {
    'fill-color': '#D7F3EF',
    'fill-opacity': 0.8
  }
})

// 3. 后续更新数据（不重建图层）
map.getSource('mySource').setData(newGeoJsonData)

// 4. 销毁
map.removeLayer('myLayer')
map.removeSource('mySource')
```

### 图层的 layout 与 paint 属性

每个图层的样式分为两大类：

| 属性类别 | 作用 | 典型属性 | 修改方式 |
|----------|------|----------|----------|
| **layout** | 控制几何布局和排列 | `visibility`、`icon-image`、`icon-size`、`text-field` | `setLayoutProperty()` |
| **paint** | 控制视觉样式和渲染效果 | `fill-color`、`line-color`、`circle-radius`、`fill-opacity` | `setPaintProperty()` |

::: tip 关键区别
- **layout** 影响几何布局，修改可能触发地图重算，性能开销较大
- **paint** 只影响渲染效果，修改不会触发几何重算，性能更优
- `feature-state` 表达式 **只能在 paint 中使用**，不能在 layout 中使用
:::

### 数据源与图层的生命周期管理

在思极地图开发中，合理管理图层生命周期至关重要：

1. **创建时判重**：通过 `map.getLayer(id)` 检查图层是否已存在，避免重复添加
2. **数据更新用 setData**：图层创建后，数据变化时使用 `setData()` 更新，而非重建图层
3. **销毁要彻底**：图层不用时，需同时销毁图层和数据源（先 `removeLayer` 再 `removeSource`），防止内存泄漏
4. **ID 统一管理**：使用有意义的唯一 ID 命名规则，便于追踪和管理

```javascript
// 推荐的销毁封装
function destoryLayer(id, isDestorySource = false) {
  if (map.value.getLayer(id)) map.value.removeLayer(id)
  if (isDestorySource && map.value.getSource(id)) {
    // 先清空数据再移除，更安全
    map.value.getSource(id).setData({ type: 'FeatureCollection', features: [] })
    map.value.removeSource(id)
  }
}
```