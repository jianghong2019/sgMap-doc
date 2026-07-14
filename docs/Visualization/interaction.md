# 业务数据交互

业务数据回显到地图后，需要支持丰富的交互操作：筛选显隐、高亮选中、透明度控制等。本章介绍项目中常用的数据交互模式。

## 数据筛选与显隐

在地图上根据业务条件动态筛选显示要素，是人员管理等模块的核心需求。

### 通过 setData 实现筛选

```javascript
// 示例 — 根据选中人员筛选显示地图数据
function setPersonAndOrderVisibility(
  selectedPersonIds,    // 选中的人员 ID 列表
  allPersonData,        // 全部人员数据
  allOrderData          // 全部工单数据
) {
  let personFeatures = []
  let orderFeatures = []
  
  if (selectedPersonIds.length === 0) {
    // 未选择人员：只显示无责任人的工单
    personFeatures = []
    orderFeatures = allOrderData.features.filter(
      o => !o.properties.responsiblePersonId
    )
  } else {
    // 选择了人员：显示选中人员 + 其负责的工单 + 无责任人工单
    personFeatures = allPersonData.features.filter(
      p => selectedPersonIds.includes(p.id)
    )
    orderFeatures = allOrderData.features.filter(
      o => selectedPersonIds.includes(o.properties.responsiblePersonId)
            || !o.properties.responsiblePersonId
    )
  }
  
  // 更新人员数据源
  map.getSource('person_pointSource').setData({
    type: 'FeatureCollection',
    features: personFeatures
  })
  
  // 更新工单数据源
  map.getSource('order_pointSource').setData({
    type: 'FeatureCollection',
    features: orderFeatures
  })
}
```

### setData 筛选 vs layout filter 筛选

| 方案 | 实现方式 | 优点 | 缺点 |
|------|----------|------|------|
| `setData()` 筛选 | 维护数据副本，筛选后 `setData` | 灵活，不改图层配置；聚类数量准确；数据恢复方便 | 需要维护数据副本 |
| `layout filter` | `setFilter(layerId, condition)` | 实时筛选，无需数据副本 | 受限于表达式能力；与聚类联用会造成数量不一致 |

```javascript
// 方式二：使用 filter 表达式筛选
// 只显示在岗人员（status === 1）
map.setFilter('person_icon_layer', ['==', ['get', 'status'], 1])

// 取消筛选（显示全部）
map.setFilter('person_icon_layer', null)
```

#### 关键区别：filter 与聚类数据源联用的问题

当数据源开启了 `cluster: true`，使用 `setFilter` 只是控制图层的渲染显隐，**并不影响底层数据源的聚类计算**。这会导致一个严重的不一致问题：

```
假设数据源中有 100 个点，filter 只显示其中 30 个

┌─────────────────────────────────────────────────────┐
│  聚合圆的 point_count 仍然 = 100                     │
│  但实际展开后，用户看到的只有 filter 通过的 30 个点    │
│  → 聚合圆显示"100个"，展开后只剩 30 个，数量对不上！   │
└─────────────────────────────────────────────────────┘
```

**解决方案**：如果数据使用了聚类，推荐用 `setData()` 方式筛选——将筛选后的数据直接传入数据源，聚类在筛选后的数据上重新计算，聚合数量自然一致。

#### 关键区别：setData 维护副本的优势

`setData()` 方案需要在组件中维护一份完整数据的副本，看似增加了代码量，实则在筛选和还原场景中更加方便：

```javascript
// 维护完整数据副本
const fullData = { type: 'FeatureCollection', features: [...originalFeatures] }

// 筛选 — 从副本中过滤，简洁直观
function filterData(condition) {
  const filtered = fullData.features.filter(condition)
  map.getSource('mySource').setData({
    type: 'FeatureCollection',
    features: filtered
  })
}

// 还原 — 一行代码恢复全部数据
function restoreAll() {
  map.getSource('mySource').setData(fullData)
}

// 多条件组合 — 链式 filter，任意组合
function multiFilter(conditions) {
  let result = fullData.features
  conditions.forEach(cond => { result = result.filter(cond) })
  map.getSource('mySource').setData({ type: 'FeatureCollection', features: result })
}
```

::: tip 何时用 setData，何时用 filter
- **setData**（推荐）：数据使用了聚类、需要跨组件共享数据、需要精细控制显示内容、筛选和还原操作频繁的场景
- **filter**：仅适用于简单的临时筛选、无聚类、不需要关心数据副本的轻量场景
:::

## 透明度控制（图片路径高亮）

在选中某个目标（人员/工单/路径）时，将其他要素降低透明度以突出重点：

```javascript
// 选中目标人员 → 目标人员完全不透明，其他人员半透明
function highlightPerson(targetPersonId) {
  const opacityExpression = [
    'case',
    ['==', ['get', 'id'], targetPersonId],
    1,      // 目标人员：完全不透明
    0.3     // 其他人员：30% 透明度
  ]
  
  // 修改人员图标图层的透明度
  map.setPaintProperty('person_icon_layer', 'icon-opacity', opacityExpression)
  
  // 修改人员头像图层的透明度
  map.setPaintProperty('person_head_layer', 'icon-opacity', opacityExpression)
}

// 取消高亮（恢复全部不透明）
function resetHighlight() {
  map.setPaintProperty('person_icon_layer', 'icon-opacity', 1)
  map.setPaintProperty('person_head_layer', 'icon-opacity', 1)
}
```

### 动态高亮完整交互

```javascript
// 外部组件中选中某个人员
function onPersonSelected(personId) {
  const map = sgMapInstance.value
  if (!map) return
  
  // 1. 降低其他要素透明度
  highlightPerson(personId)
  
  // 2. 飞行到该人员位置
  const feature = allPersonData.features.find(f => f.id === personId)
  if (feature) {
    map.flyTo({
      center: feature.geometry.coordinates,
      zoom: 16,
      duration: 1000
    })
  }
  
  // 3. 设置选中状态
  if (lastSelectedId) {
    map.setFeatureState(
      { source: 'person_pointSource', id: lastSelectedId },
      { selected: false }
    )
  }
  map.setFeatureState(
    { source: 'person_pointSource', id: personId },
    { selected: true }
  )
  lastSelectedId = personId
}
```

## 面图层 + 线图层联动交互

在区域可视化中，面图层作为主体区域，线图层作为边界轮廓，两者配合 Feature State 实现联动高亮：

```javascript
// 1. 创建数据源
map.addSource('areaSource', {
  type: 'geojson',
  data: areaGeoJSON
})

// 2. 创建面图层（hover 高亮）
map.addLayer({
  id: 'areaFillLayer',
  type: 'fill',
  source: 'areaSource',
  paint: {
    'fill-color': '#D7F3EF',
    'fill-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,       // hover 时不透明
      0.8      // 默认 80% 不透明
    ]
  }
})

// 3. 创建线图层（支持虚线）
map.addLayer({
  id: 'areaLineLayer',
  type: 'line',
  source: 'areaSource',
  paint: {
    'line-color': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      '#009B83',  // hover 时高亮色
      '#68AFB0'    // 默认色
    ],
    'line-width': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      4,    // hover 时加粗
      2     // 默认宽度
    ],
    'line-dasharray': [
      'case',
      ['==', ['get', 'lineType'], 'dashed'],
      ['literal', [1, 4]],
      ['literal', []]
    ]
  }
})

// 4. 鼠标悬浮联动
let hoveredId = null

map.on('mousemove', 'areaFillLayer', (e) => {
  map.getCanvas().style.cursor = 'pointer'
  
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['areaFillLayer']
  })
  
  if (features.length > 0) {
    const newId = features[0].id
    if (newId !== hoveredId) {
      // 清除旧状态
      if (hoveredId) {
        map.setFeatureState({ source: 'areaSource', id: hoveredId }, { hover: false })
      }
      // 设置新状态（面图层和线图层会同步响应）
      hoveredId = newId
      map.setFeatureState({ source: 'areaSource', id: hoveredId }, { hover: true })
    }
  }
})

map.on('mouseleave', 'areaFillLayer', () => {
  map.getCanvas().style.cursor = ''
  if (hoveredId) {
    map.setFeatureState({ source: 'areaSource', id: hoveredId }, { hover: false })
    hoveredId = null
  }
})

// 5. 点击选中
map.on('click', 'areaFillLayer', (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['areaFillLayer']
  })
  if (features.length > 0) {
    const area = features[0].properties
    console.log('选中区域:', area.name, area.adcode)
    // 触发外部组件的区域选中事件
    onAreaSelected(area)
  }
})
```

### 为什么 Feature State 只能修改 paint 不能修改 layout

在上述示例中，feature-state 表达式**仅在 `paint` 中使用**（如 `fill-opacity`、`line-color`、`line-width`），不能用于 `layout` 属性（如 `icon-size`、`text-field`）。其根本原因在于思极地图（基于 Mapbox GL）的渲染管线中，paint 和 layout 处于不同阶段：

```
渲染管线
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  layout 属性  │ → │  几何计算      │ → │  paint 属性   │ → 绘制到屏幕
│  (几何布局)   │    │  (GPU顶点)    │    │  (视觉样式)   │
└─────────────┘    └──────────────┘    └──────────────┘
                         ↑                    ↑
                    layout 阶段             paint 阶段
                feature-state 不可用    feature-state 可用
```

| 阶段 | 处理内容 | feature-state 状态 | 原因 |
|------|----------|-------------------|------|
| **layout** | 图标选择、文字排版、锚点位置 | ❌ 不可用 | layout 在几何计算之前确定，此时 feature-state 还未绑定到具体顶点 |
| **paint** | 颜色、透明度、线宽 | ✅ 可用 | paint 在几何确定后执行，feature-state 已作为 per-feature 数据注入到渲染批次中 |

简单理解：feature-state 是随要素数据一起传到 GPU 的运行时属性，它附着在已确定的几何顶点上。layout 要决定"用哪个图标、文字放哪里"，这些必须在几何计算前确定，因此无法引用运行时才绑定的 feature-state。而 paint 要决定"画什么颜色、多透明"，几何已经算好了，此时读取 feature-state 完全没有问题。

::: danger 常见错误
```javascript
// ❌ 错误：layout 中使用 feature-state（不会生效）
layout: {
  'icon-size': ['case', ['boolean', ['feature-state', 'hover'], false], 0.6, 0.4]
}

// ✅ 正确：paint 中使用 feature-state
paint: {
  'icon-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.5]
}
```
:::

### 为什么用 mousemove 而不是 mouseover / mouseenter

在实现 hover 高亮时，代码使用的是 `mousemove` 事件而非 `mouseover` 或 `mouseenter`，原因在于这两个事件的触发机制不同：

| 事件 | 触发时机 | 在相邻要素间移动 |
|------|----------|-----------------|
| `mouseover` / `mouseenter` | 鼠标**首次进入**要素时触发一次 | **不会再次触发**——从一个面滑到另一个面，鼠标始终在图层范围内，不会触发新事件 |
| `mousemove` | 鼠标**在要素范围内移动**时持续触发 | **持续触发**——每次移动都会检测鼠标下的要素 |

```
鼠标从A面滑到B面的过程：

  ┌───────┐    ┌───────┐
  │   A   │ →  │   B   │    mouseover/mouseenter：进入A时触发一次，滑到B时不会触发
  └───────┘    └───────┘    mousemove：整个过程持续触发，能检测到要素从A变为B
```

**为什么 mouseover 在相邻要素间不触发**：图层的 `mouseover`/`mouseenter` 事件是基于图层维度的——只要鼠标在图层范围内，就不会重新触发进入事件。从一个面要素滑到另一个面要素时，鼠标始终在同一个图层上，因此不会有新的 `mouseover`/`mouseenter`。而 `mousemove` 每次移动都会执行 `queryRenderedFeatures` 检测鼠标下的要素，发现要素 ID 变化时可以及时切换高亮。

::: tip 使用 mousemove 的性能注意
虽然 `mousemove` 触发频率高（每秒数十次），但配合 `queryRenderedFeatures` + Feature State 是高效的——Feature State 只更新渲染状态，不触发数据源变更，几百次更新也不会造成性能问题。关键是在回调中先判断要素 ID 是否变化，避免对同一个要素重复 `setFeatureState`。
:::

## 外部组件与地图联动

在实际业务中，左侧列表或卡片组件需要与地图实时联动：

```javascript
// PersonCardItem.vue — 外部组件控制地图交互
export default {
  data() {
    return {
      hoveredCityId: null,
      hoveredProperties: {}
    }
  },
  
  methods: {
    // 鼠标悬浮卡片 → 地图对应区域高亮
    handleCardMouseMove(e) {
      const map = this.sgMapInstance  // 通过 props 或 inject 获取
      if (!map) return
      
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['areaFillLayer']
      })
      
      if (features.length > 0) {
        const newId = features[0].id
        if (newId !== this.hoveredCityId) {
          // 清除旧高亮
          if (this.hoveredCityId) {
            map.setFeatureState(
              { source: 'areaSource', id: this.hoveredCityId },
              { hover: false }
            )
          }
          // 设置新高亮
          this.hoveredCityId = newId
          this.hoveredProperties = features[0].properties
          map.setFeatureState(
            { source: 'areaSource', id: this.hoveredCityId },
            { hover: true }
          )
        }
      }
    },
    
    // 组件隐藏时清除状态
    onVisibleChange(newVal) {
      if (!newVal && this.hoveredCityId) {
        const map = this.sgMapInstance
        if (map) {
          map.setFeatureState(
            { source: 'areaSource', id: this.hoveredCityId },
            { hover: false }
          )
        }
        this.hoveredCityId = null
        this.hoveredProperties = {}
      }
    }
  }
}
```

## 表达式驱动的动态样式

思极地图图层支持丰富的表达式语法，实现数据驱动的动态样式：

### 常用表达式速查

| 表达式 | 功能 | 示例 |
|--------|------|------|
| `['get', 'prop']` | 读取属性值 | `['get', 'color']` |
| `['case', cond, v1, default]` | 条件判断 | `['case', ['==', ['get', 'status'], 1], 'green', 'gray']` |
| `['match', val, k1, v1, ..., default]` | 多值匹配 | `['match', ['get', 'type'], 1, 'icon_a', 2, 'icon_b', 'icon_default']` |
| `['concat', ...args]` | 字符串拼接 | `['concat', '工单-', ['get', 'id']]` |
| `['boolean', expr, default]` | 布尔转换 | `['boolean', ['feature-state', 'hover'], false]` |
| `['has', 'prop']` | 检查属性是否存在 | `['has', 'headImage']` |
| `!has` | 属性不存在 | `['!has', 'headImage']` |
| `['!=', a, b]` | 不等于 | `['!=', ['get', 'name'], '']` |
| `['literal', [v1, v2]]` | 字面量数组 | `['literal', [1, 4]]` |

### 表达式实战案例

```javascript
// 根据预警级别动态颜色
'fill-color': [
  'match',
  ['get', 'warningDegree'],
  '01', '#FF6B6B',  // 一级预警：红色
  '02', '#FFA94D',  // 二级预警：橙色
  '03', '#FFD43B',  // 三级预警：黄色
  '04', '#69DB7C',  // 四级预警：绿色
  '#CED4DA'          // 默认：灰色
]

// 根据是否有数据决定显示文字
'text-field': [
  'case',
  ['has', 'point_count'],
  ['concat', ['get', 'point_count'], '个'],  // 聚合圆显示数量
  ''                                          // 普通点不显示
]

// 条件控制线型
'line-dasharray': [
  'case',
  ['==', ['get', 'lineType'], 'dashed'],
  ['literal', [1, 4]],   // 虚线
  ['literal', []]         // 实线
]
```

## 综合实战：人员工单联动筛选

下面是一个完整的人员-工单联动筛选示例：

```javascript
// 选中人员 → 地图联动筛选
function onPersonSelected(selectedPersonIds) {
  const map = sgMapInstance.value
  if (!map) return
  
  // 1. 筛选人员显示
  const personFeatures = selectedPersonIds.length === 0
    ? []
    : allPersonData.features.filter(p => selectedPersonIds.includes(p.id))
  
  map.getSource('person_pointSource').setData({
    type: 'FeatureCollection',
    features: personFeatures
  })
  
  // 2. 筛选工单显示（选中人员的工单 + 无责任人工单）
  const orderFeatures = allOrderData.features.filter(o =>
    selectedPersonIds.includes(o.properties.responsiblePersonId)
    || !o.properties.responsiblePersonId
  )
  
  map.getSource('order_pointSource').setData({
    type: 'FeatureCollection',
    features: orderFeatures
  })
  
  // 3. 缩放以显示筛选结果
  const allFeatures = [...personFeatures, ...orderFeatures]
  if (allFeatures.length > 0) {
    fitBounds(allFeatures, { padding: 80 })
  }
}
```
