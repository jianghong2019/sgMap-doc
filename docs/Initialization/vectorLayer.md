# 矢量图层

获取到地图实例后，可以创建矢量图层，图层设置一次即可，后续数据改变是更改数据源

## 图层创建

创建地图需要一些配置参数以及预先引入sg的资源，[示例](https://jianghong2019.github.io/sgMap-demo/)中才用在线方式引入 。

**官方api截图** 
以创建面图层为例
![此处为官方创建面图层的api](../images/api-2.png)

**官方api使用**
```` md
```useVectorLayer.js
export const useVectorLayer = (map) => {
    const removeLayer = (id) => {
        map?.value.removeLayer(id)
        removeLayerSource(id)
    }
    const removeLayerSource = (id) => {
        map.value?.getSource(id).setData({
            type: "FeatureCollection",
            features: [],
        });
        map?.value.removeSource(id)
    }
    const setPolygonSource = (properties, layerId, level) => {
        const list = properties.sub_districts || []
        let features = []
        list.map((r) => {
            const {
                shape: geometry
            } = r
            features.push({
                type: "Feature",
                geometry,
                properties: {
                    color: '#68AFB0',
                    ...r
                },
            })
        })
        console.log(features, "面数据", layerId);
        map.value?.getSource(layerId).setData({
            type: "FeatureCollection",
            features
        });
        return list
    }
    const addPolygonLayer = (district, id = 'polygonLayer') => {
        const polygonSource = ref(null)
        watch(district, (newValue, oldValue) => {
            if (!newValue) return
            if (!map.value?.getLayer(id)) {
                map.value?.addLayer({
                    id,
                    type: "fill",
                    source: {
                        type: "geojson",
                        data: {
                            type: "FeatureCollection",
                            features: [],
                        },
                    },
                    paint: {
                        "fill-color": ["get", "color"],
                        "fill-opacity": 1
                    },
                    // paint: {
                    // 	"fill-color": ["get", "color"],
                    // 	"fill-opacity": ["get", "opacity"]
                    // },
                });
            }
            polygonSource.value = setPolygonSource(newValue, id)
        })
        return {
            polygonSource,
            id,
            layer: map.value?.getLayer(id),
            removeLayer: () => removeLayer(id)
        }
    }
}
```
````
::: tip
1. 图层上的元素显隐可以通过两种方式实现：销毁图层；销毁（置空）数据源。当决定需要销毁某个图层时，尽量一并将其所有数据源都销毁.
2. 初始化图层后，可以将图层id、图层实例以及图层销毁的方法返回出去，以便在外部组件中共用，尽量减少封装后的功能与外部业务组件过多耦合.
3. 具体的图层及要素样式可以根据业务区需求做修改. 
4. 创建图层及数据源时，一定要创建唯一id，对唯一id可以统一管理，通过id可以获取到很多有用的东西：
   1. map.value?.getLayer(id) - 获取图层
   2. map.value?.getSource(layerId).setData({type: "FeatureCollection",features}) - 获取数据源，并给数据源重新添加数据（页面要素更新）
   3. map?.value.removeLayer(id) - 销毁图层
   4. map?.value.removeSource(id) - 销毁数据源

:::


**调用方法**

````md
```sceneWork.vue
<script setup>
    /* 模拟数据 */
    const adCode = ['361000', '360500', '360100', '360300', '360800']
    import { sgMapInstance, useVectorLayer } from '@/composables/useMap'
    const { getDistrict, addPolygonLayer } = useVectorLayer(sgMapInstance)
    const randomItem = ref('')
    const handlerLayer = async () => {
      randomItem.value = adCode[Math.floor(Math.random() * adCode.length)]
      console.log('通过城市编码查询城市边界数据', randomItem)
    }
    const { district, isPending } =  getDistrict(randomItem)
    /* 添加多边形图层 */
    const { removeLayer } = addPolygonLayer(district)
</script>
<template>
  <main absolute w-full z-5>
    <button :disabled="isPending" @click="handlerLayer">切换矢量图层</button>
    <button :disabled="isPending"  @click="removeLayer">销毁矢量图层</button>
  </main>
</template>
```
````

## 视频演示
<video width="320" height="240" controls>
  <source src="../images/demo-1.mp4" type="video/mp4">
</video>

## 更多图层类型

除了面图层（fill），思极地图还支持多种常用的矢量图层类型。

### 线图层（Line）

用于绘制边界线、路径、轨迹等：

```javascript
map.addLayer({
  id: 'boundaryLine',
  type: 'line',
  source: 'lineSource',
  paint: {
    'line-color': ['case', ['has', 'lineColor'], ['get', 'lineColor'], 'rgba(0, 155, 131, 1)'],
    'line-width': ['case', ['has', 'lineWidth'], ['get', 'lineWidth'], 3],
    'line-dasharray': [                      // 支持虚线样式
      'case',
      ['==', ['get', 'lineType'], 'dashed'],
      ['literal', [1, 4]],                   // 虚线：1px实线 + 4px空白
      ['literal', []]                         // 实线
    ]
  }
})
```

`line-dasharray` 格式说明：
- `[1, 4]` 表示 1px 实线 + 4px 空白，循环重复
- `[]` 空数组表示实线

### 圆点图层（Circle）

用于绘制圆形标记，支持 Feature State 动态大小和颜色：

```javascript
map.addLayer({
  id: 'circlePointLayer',
  type: 'circle',
  source: 'pointSource',
  filter: ['!has', 'point_count'],
  paint: {
    'circle-radius': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      14,                                   // hover 时更大
      10                                     // 默认大小
    ],
    'circle-color': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      '#009B83',                            // hover 时的高亮色
      '#7B919B'                              // 默认颜色
    ],
    'circle-stroke-color': '#fff',
    'circle-stroke-width': 1
  }
})
```

### 图标图层（Symbol）

用于显示图标和文字标记，是最常用的点标记图层：

```javascript
// 人员图标图层 — 根据属性动态匹配图标
map.addLayer({
  id: 'personIconLayer',
  type: 'symbol',
  source: 'personSource',
  filter: ['!has', 'point_count'],
  layout: {
    'icon-image': [
      'match',
      ['get', 'iconIndex'],                 // 根据属性选择图标
      1, 'icon_person_normal',
      2, 'icon_person_working',
      3, 'icon_person_offline',
      'icon_person_normal'                  // 默认图标
    ],
    'icon-size': 0.5,
    'icon-anchor': 'bottom'                 // 图标底部锚定在点位上
  }
})

// 人员头像图层 — 支持远程 URL 头像
map.addLayer({
  id: 'personHeadUrlLayer',
  type: 'symbol',
  source: 'personSource',
  filter: ['!has', 'point_count'],
  layout: {
    'icon-image': [
      'case',
      ['all', ['has', 'headImage'], ['!=', ['get', 'headImage'], ''], ['!=', ['get', 'headImage'], null]],
      ['concat', baseUrl, ['get', 'headImage']],  // 拼接完整 URL
      ''                                           // 无头像时为空
    ],
    'icon-offset': [0, -100],                // 头像显示在图标上方
    'icon-size': 0.186
  }
})
```

### 图层类型速查

| 类型 | 对应几何 | 适用场景 |
|------|----------|----------|
| `fill` | Polygon | 区域填充（行政区划、责任区） |
| `line` | LineString | 边界、路径、轨迹 |
| `circle` | Point | 圆点标记（支持 Feature State 动态大小） |
| `symbol` | Point | 图标、文字、头像标记 |
| `background` | — | 背景蒙层 |

## 数据源更新

图层创建后，数据变化时**不需要重建图层和数据源**，只需调用数据源的 `setData()` 方法：

```javascript
// 获取已存在的数据源并更新
map.getSource('mySource').setData(newGeoJson)

// 典型场景：人员/工单数据更新
function updatePersonLayer(newPersonData) {
  const source = map.getSource('person_pointSource')
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: newPersonData.map(p => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { ...p }
      }))
    })
    // 图层自动刷新，无需重建
  }
}
```

### setData vs 重建图层

| 方案 | 优点 | 缺点 |
|------|------|------|
| `setData()` 更新 | 只更新数据，图层配置不变，性能好 | 数据结构需保持一致 |
| 删除后重建 | 适合结构大改（如几何类型变化） | 需要销毁+重新创建，性能差 |

::: tip setData 注意事项
1. 新数据必须与原始数据源类型一致（都是 `geojson`）
2. Feature ID 保持一致：如果使用了 `setFeatureState`，确保新数据的 Feature ID 与旧数据一致
3. 聚类数据源调用 `setData()` 后，聚合会自动重新计算
4. `setData()` 只更新数据，不修改 paint/layout/filter 等配置
:::

## Feature State — 要素状态管理

Feature State 是思极地图实现高效交互的核心机制，可以在不触发数据源更新的情况下，只改变渲染效果。

### 为什么用 Feature State

| 方案 | 优点 | 缺点 |
|------|------|------|
| 修改数据源 + `setData()` | 直观 | 触发数据更新，性能差，不适合高频交互 |
| 添加/移除独立高亮图层 | 简单场景可用 | 需额外管理图层，复杂场景难以维护 |
| **Feature State** | 不触发数据更新、只影响渲染层、性能优秀 | 数据源必须配置 `generateId: true` 或要素有唯一 `id` |

### 基本使用

```javascript
// 1. addSource 时启用 generateId
map.addSource('mySource', {
  type: 'geojson',
  data: geoJsonData,
  generateId: true  // 必须！自动生成 feature.id
})

// 2. 在 paint 中使用 feature-state 表达式
map.addLayer({
  id: 'myLayer',
  type: 'fill',
  source: 'mySource',
  paint: {
    'fill-color': '#D7F3EF',
    'fill-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,   // hover 时不变透
      0.8  // 默认透明度
    ]
  }
})

// 3. 在交互事件中设置状态
let hoveredId = null

map.on('mousemove', 'myLayer', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['myLayer'] })
  if (features.length > 0) {
    const newId = features[0].id
    if (newId !== hoveredId) {
      // 清除旧 hover 状态
      if (hoveredId) {
        map.setFeatureState({ source: 'mySource', id: hoveredId }, { hover: false })
      }
      // 设置新 hover 状态
      hoveredId = newId
      map.setFeatureState({ source: 'mySource', id: hoveredId }, { hover: true })
    }
  }
})

// 4. mouseleave 时清除状态
map.on('mouseleave', 'myLayer', () => {
  if (hoveredId) {
    map.setFeatureState({ source: 'mySource', id: hoveredId }, { hover: false })
    hoveredId = null
  }
})
```

### 重要限制

::: danger Feature State 只能在 paint 中使用
`['feature-state', 'key']` 表达式 **只能在 paint 属性中使用，在 layout 属性中无效**。
:::

```javascript
// ✅ 正确：在 paint 中使用 feature-state
paint: {
  'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.8],
  'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 14, 10]
}

// ❌ 错误：在 layout 中使用 feature-state（不会生效）
layout: {
  'icon-size': ['case', ['boolean', ['feature-state', 'hover'], false], 0.6, 0.4]  // 无效！
}
```

## 图层销毁最佳实践

合理的图层销毁流程能有效防止内存泄漏和地图性能下降：

```javascript
// 推荐的销毁函数封装
function destoryLayer(id, isDestorySource = false) {
  // 1. 先销毁图层
  if (map.getLayer(id)) {
    map.removeLayer(id)
  }
  // 2. 根据需要销毁数据源
  if (isDestorySource && map.getSource(id)) {
    // 先清空数据再移除，更安全
    map.getSource(id).setData({ type: 'FeatureCollection', features: [] })
    map.removeSource(id)
  }
}

function destorySource(id) {
  if (map.getSource(id)) {
    map.getSource(id).setData({ type: 'FeatureCollection', features: [] })
    map.removeSource(id)
  }
}

// 使用示例
destoryLayer('polygonLayer', false)     // 只销毁图层
destoryLayer('boundaryLine', true)       // 销毁图层 + 数据源
destorySource('pointSource')             // 销毁独立数据源
```

::: tip 为什么先清空再移除
直接调用 `removeSource()` 在部分场景下可能报错。先通过 `setData()` 将数据清空为空的 `FeatureCollection`，再执行 `removeSource()` 更加稳定。
:::

## 图层显隐控制

除了销毁图层，也可以通过 `setLayoutProperty` 控制图层的显隐：

```javascript
// 隐藏图层
map.setLayoutProperty('myLayer', 'visibility', 'none')

// 显示图层
map.setLayoutProperty('myLayer', 'visibility', 'visible')
```

`visibility` 只有三个可选值：`visible`（可见）、`none`（隐藏）、`undefined`（使用默认值）。

::: tip 显隐 vs 销毁
- **显隐切换**：适合频繁切换的场景，保留图层和数据源，性能开销小
- **销毁重建**：适合彻底不再需要的场景，释放内存
:::
