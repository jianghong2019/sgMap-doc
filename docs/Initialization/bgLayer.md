# 背景图层

背景图层是地图最底层的底图，决定了地图的整体视觉风格。思极地图提供了多种预置底图样式，并支持通过路网插件实现影像图与道路标注的融合效果。

## 预置底图样式

思极地图 SDK 内置了多种矢量瓦片底图样式，通过创建地图实例时的 `style` 参数指定：

| 样式 ID | 说明 | 适用场景 |
|---------|------|----------|
| `aegis://styles/aegis/Streets-v2` | 街道地图（默认） | 日常办公、管理后台 |
| `aegis://styles/aegis/Satellite` | 卫星影像图 | 需要真实地理信息的场景 |
| `aegis://styles/aegis/Satellite512` | 高分辨率卫星影像（512px 瓦片） | 精细化的户外作业、巡视 |

```javascript
// 使用街道地图
const map = new SGMap.Map({
  container: 'sgMap',
  style: 'aegis://styles/aegis/Streets-v2',
  zoom: 9,
  center: [116.397428, 39.90923]
})

// 使用卫星影像图
const map = new SGMap.Map({
  container: 'sgMap',
  style: 'aegis://styles/aegis/Satellite512',
  zoom: 9,
  center: [116.397428, 39.90923],
  maxZoom: 24  // 影像图支持更高的缩放级别
})
```

::: tip 街道图 vs 影像图
- **街道地图**：矢量底图，自带道路名称、地标标注，样式统一，适合后台管理系统
- **卫星影像图**：真实卫星影像，提供更真实的地理信息，适合巡视作业、现场作业等需要判断实地环境的场景
:::

## 影像图 + 路网图融合

思极地图的卫星影像图（`Satellite` / `Satellite512`）**只包含卫星影像**，不包含道路名称、行政区划等标注信息。如果需要叠加路网标注，需要使用 `RoadNetLayer` 插件。

### 实现步骤

**步骤 1：加载 RoadNetLayer 插件**

在初始化时，将 `SGMap.RoadNetLayer` 加入插件列表：

```javascript
SGMap.plugin([
  'SGMap.DistrictPlusTask',
  'SGMap.GeolocationTask',
  'SGMap.ConvertTask',
  'SGMap.RoadNetLayer',   // 路网图层插件
]).then(() => {
  // 创建地图...
})
```

**步骤 2：初始化地图时使用影像图样式**

```javascript
const map = new SGMap.Map({
  container: 'sgMap',
  style: 'aegis://styles/aegis/Satellite512',  // 影像图底图
  zoom: 9,
  center: [116.397428, 39.90923],
  maxZoom: 24
})
```

**步骤 3：地图加载完成后初始化 RoadNetLayer**

必须在 `map.on('load', ...)` 回调中初始化路网图层：

```javascript
map.on('load', () => {
  // 初始化路网图层（叠加在影像图上）
  const roadNetLayer = new SGMap.RoadNetLayer({
    map: map,
    style: 'aegis://styles/aegis/Road'  // 路网样式
  })
  roadNetLayer.render()  // 添加路网图层到地图
})
```

### 完整示例

```javascript
// SgMap.vue — 地图容器组件
import { shallowRef } from 'vue'

async function initMap() {
  // 1. 认证
  await SGMap.tokenTask.login(appkey, appsecret)
  
  // 2. 加载插件（包含 RoadNetLayer）
  await SGMap.plugin([
    'SGMap.DistrictPlusTask',
    'SGMap.GeolocationTask',
    'SGMap.ConvertTask',
    'SGMap.RoadNetLayer'
  ])
  
  // 3. 创建地图（影像图底图）
  const map = new SGMap.Map({
    container: 'sgMap',
    style: 'aegis://styles/aegis/Satellite512',
    zoom: 9,
    center: [116.397428, 39.90923],
    maxZoom: 24,
    doubleClickZoom: false
  })
  
  // 4. 地图加载完成后叠加路网
  map.on('load', () => {
    sgMapInstance.value = map
    
    const roadNetLayer = new SGMap.RoadNetLayer({
      map: map,
      style: 'aegis://styles/aegis/Road'
    })
    roadNetLayer.render()
  })
  
  return map
}
```

### 效果对比

| 配置 | 效果 |
|------|------|
| `style: 'Streets-v2'` | 街道地图（矢量底图 + 标注） |
| `style: 'Satellite512'`（无 RoadNetLayer） | 纯卫星影像，无标注 |
| `style: 'Satellite512'` + `RoadNetLayer` | 卫星影像 + 路网标注 |

::: warning 注意事项
1. `RoadNetLayer.render()` 必须在 `map.on('load')` 之后调用，确保地图样式已加载完成
2. 路网图层的 `style` 与底图的 `style` 是独立的，互不影响
3. 影像图支持更高的缩放级别（`maxZoom: 24`），街道图通常为 20 级
:::

## 背景蒙层（Background Layer）

除了底图样式，思极地图还支持创建 `background` 类型的图层作为蒙层效果：

```javascript
// 添加深色半透明背景蒙层
map.addLayer({
  id: 'backgroundMask',
  type: 'background',
  paint: {
    'background-color': '#000000',
    'background-opacity': 0.4
  }
})

// 通过 setLayoutProperty 控制蒙层显隐
map.setLayoutProperty('backgroundMask', 'visibility', 'visible')   // 显示
map.setLayoutProperty('backgroundMask', 'visibility', 'none')      // 隐藏
```

::: tip 使用场景
背景蒙层通常用于弹窗、抽屉等交互场景，在地图上方叠加半透明遮罩，聚焦用户注意力。
:::