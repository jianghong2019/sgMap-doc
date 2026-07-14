# 聚类图层

当地图上需要展示大量点位（几百到上万个）时，如果直接渲染所有点，会导致地图卡顿甚至崩溃。聚类图层（Cluster Layer）可以将临近的点聚合为一个聚合圆，只展示聚合后的统计信息，极大提升性能。

## 为什么需要聚类

| 直接渲染所有点 | 使用聚类图层 |
|---------------|-------------|
| 性能差，DOM 节点过多 | 只渲染可见的聚合圆，性能优良 |
| 视觉混乱，无法辨认 | 清晰展示点的数量和分布 |
| 放大后仍然密集 | 随缩放级别动态调整聚合粒度 |
| 无法做统计分析 | 支持聚合统计（clusterProperties） |

## 创建聚类数据源

在创建数据源时，开启 `cluster: true` 并配置 `clusterProperties`：

```javascript
// 创建聚类数据源
map.addSource('order_pointSource', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: [
      // GeoJSON 点位数据...
    ]
  },
  cluster: true,               // 开启聚类
  clusterMaxZoom: 17,          // 最大聚合缩放级别（超过此级别不再聚合）
  clusterRadius: 60,           // 聚合半径（像素），范围内的点聚合为一个圆
  clusterProperties: {         // 聚合统计属性
    // 统计含有 warningDegree='04' 的点数量
    hasWarning04: ['any', ['==', ['get', 'warningDegree'], '04']],
    // 统计 warningDegree='0' 的点数量
    hasWarning0: ['any', ['==', ['get', 'warningDegree'], '0']],
    // 统计 isNoManage=1 的点总数
    isNoManage_count: ['+', ['case', ['==', ['get', 'isNoManage'], 1], 1, 0]],
    // 统计全部点数量
    total_count: ['+', 1]
  }
})
```

### clusterProperties 属性说明

`clusterProperties` 中定义的每个属性，在聚合发生后会**自动计算并挂载到聚合圆的 `properties` 上**。聚合圆可以通过 `['get', '属性名']` 在表达式中读取这些聚合统计值，实现数据驱动的样式展示。

**数据流转示意**：

```
原始点数据 → 聚合计算 → 聚合圆的 properties → 表达式读取 → 动态样式 / 文本展示
```

例如，`total_count` 聚合了 5 个点，则聚合圆的 `properties.total_count` 值为 `5`，可以在图层中这样使用：

```javascript
// 在聚合圆图层中读取 clusterProperties 的统计值
'text-field': [
  'concat',
  ['get', 'point_count'],           // SDK 内置：聚合点数量
  '个工单\n',
  '预警:', ['get', 'total_count'],  // 自定义：clusterProperties 中的 total_count
  '个'
],

// 根据聚合统计值动态改变聚合圆颜色
'icon-color': [
  'case',
  ['boolean', ['get', 'hasWarning04'], false],  // 有四级预警
  '#FF6B6B',                                      // 红色聚合圆
  '#69DB7C'                                        // 绿色聚合圆
]
```

| 聚合方式 | 表达式 | 说明 |
|----------|--------|------|
| 逻辑或 | `['any', condition]` | 任一子点满足条件则为 `true`，可用于判断聚合圆内是否包含某种要素 |
| 逻辑与 | `['all', condition]` | 全部子点满足条件才为 `true`，可用于判断聚合圆内是否全部为某种要素 |
| 累加 | `['+', value]` | 对子点的值求和，可用于统计聚合圆内某类数值的总和 |
| 平均值 | `['+', value]` / `['+', 1]` | 需配合除法计算平均值 |

## 创建聚类图层

聚类数据源需要同时创建**两个图层**：聚合圆图层和普通点图层，通过 `filter` 区分：

```javascript
// ===== 聚合圆图层 =====
// 当点聚合时显示，展示聚合统计信息
map.addLayer({
  id: 'layer_order_cluster',
  type: 'symbol',
  source: 'order_pointSource',
  filter: ['has', 'point_count'],     // 只渲染聚合点（有 point_count 属性）
  layout: {
    'icon-image': 'icon_order_1',     // 聚合图标
    'icon-size': 0.8,
    'text-field': [                    // 显示聚合数量文本
      'concat',
      ['get', 'point_count'],          // 聚合点数量
      '个\n',
      '工单'
    ],
    'text-size': 12,
    'text-offset': [0, 0],
    'text-anchor': 'center'
  },
  paint: {}
})

// ===== 普通点图层 =====
// 当点未聚合时显示，展示单个点的详情
map.addLayer({
  id: 'layer_order_point',
  type: 'symbol',
  source: 'order_pointSource',
  filter: ['!has', 'point_count'],    // 只渲染非聚合点（无 point_count 属性）
  layout: {
    'icon-image': [
      'match',
      ['get', 'iconIndex'],           // 根据属性动态选择图标
      1, 'icon_order_1',
      2, 'icon_order_2',
      'icon_order_1'                  // 默认图标
    ],
    'icon-size': 0.5,
    'icon-anchor': 'bottom'
  }
})
```

### 图层 filter 说明

这两个 filter 依赖的是 `point_count` 属性——它是思极地图 SDK 在开启聚类后**自动注入**到数据源中的特殊字段：

| 属性 | 来源 | 何时存在 | 含义 |
|------|------|----------|------|
| `point_count` | SDK 自动生成 | **仅在聚合圆上存在** | 该聚合圆包含了多少个原始点 |
| `cluster_id` | SDK 自动生成 | **仅在聚合圆上存在** | 聚合圆的唯一标识（用于展开查询） |
| `cluster` | SDK 自动生成 | **仅在聚合圆上存在** | 标记该要素为聚合圆 |

**关键理解**：同一个数据源中的要素分为两种身份，通过 `point_count` 的有无来区分：

```
同一个聚类数据源中的要素
├── 聚合圆（多个点聚合而成）
│   └── 包含 point_count / cluster_id / clusterProperties 计算结果
│   └── filter: ['has', 'point_count']  → 匹配 ✅
│
└── 单个原始点（未聚合 / 放大后拆分）
    └── 只有原始 properties，无 point_count
    └── filter: ['!has', 'point_count'] → 匹配 ✅
```

**为什么必须用两个图层分开渲染**：

1. **数据结构不同**：聚合圆需要显示统计文本（如"5个工单"），而单个点需要显示具体信息（如工单编号）。两者属性结构不一样，无法用同一个 `layout` 来表达
2. **图标不同**：聚合圆用统一的聚合图标，单个点则根据 `iconIndex` 动态匹配不同图标
3. **交互不同**：点击聚合圆要展开聚合，点击单个点要弹出详情

| 图层 | filter 值 | 匹配对象 | 为什么这么写 |
|------|-----------|----------|-------------|
| 聚合圆图层 | `['has', 'point_count']` | 聚合后的圆 | 聚合圆有 `point_count`，`has` 检查该属性存在则渲染 |
| 普通点图层 | `['!has', 'point_count']` | 未聚合的单个点 | 单个点无 `point_count`，`!has` 检查该属性不存在则渲染 |

::: tip 两个图层如何切换
两个 filter 是**互斥**的——同一个要素不可能同时满足两个 filter，因此同一时刻只有一种图层可见：

- **缩小地图（低缩放级别）**：点聚合成聚合圆，聚合圆有 `point_count` → 聚合圆图层显示，普通点图层隐藏
- **放大地图（高缩放级别）**：聚合圆拆分为单个点，单个点无 `point_count` → 普通点图层显示，聚合圆图层隐藏

这种互斥机制由思极地图底层自动完成，开发者只需写好两个 filter，无需手动判断缩放级别。
:::

## 聚合点击交互

点击聚合圆后，需要展开聚合或放大查看：

```javascript
// 监听聚合圆图层的点击事件
map.on('click', 'layer_order_cluster', (e) => {
  // 1. 获取点击位置的渲染要素
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['layer_order_cluster']
  })
  
  if (!features.length) return
  
  const clusterId = features[0].properties.cluster_id
  const clusterSource = map.getSource('order_pointSource')
  
  // 2. 获取展开此聚合所需的最佳缩放级别
  clusterSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (err) return
    
    // 3. 缓动移动到聚合中心，并放大到合适级别
    map.easeTo({
      center: features[0].geometry.coordinates,
      zoom: Math.min(zoom, 17),  // 限制最大缩放级别
      duration: 500
    })
  })
})
```

### 聚合层级展开方法

思极地图提供了三种聚合展开相关的方法：

| 方法 | 说明 |
|------|------|
| `source.getClusterExpansionZoom(clusterId, callback)` | 获取展开聚合所需的最佳缩放级别 |
| `source.getClusterChildren(clusterId, callback)` | 获取聚合圆的下一级子节点（渐进式展开） |
| `source.getClusterLeaves(clusterId, limit, offset, callback)` | 获取聚合圆中所有叶子节点（可限制数量） |

```javascript
const source = map.getSource('order_pointSource')

// 方案一：获取最佳缩放级别 → 放大
source.getClusterExpansionZoom(clusterId, (err, zoom) => {
  map.easeTo({ center: [lng, lat], zoom })
})

// 方案二：获取下一级子聚合节点（不改变缩放，只在当前级别展开）
source.getClusterChildren(clusterId, (err, children) => {
  console.log('子聚合节点:', children)  // children 为 FeatureCollection
})

// 方案三：获取聚合圆中所有原始点
source.getClusterLeaves(clusterId, 50, 0, (err, leaves) => {
  console.log('前 50 个叶子节点:', leaves)
})
```

## 业务实战：工单聚类示例

下面是一个完整的工单聚类图层创建流程：

```javascript
// useMapInit.js — 地图初始化完成后创建聚类图层
map.on('load', () => {
  createOrderClusterLayer(map, orderData)
})

function createOrderClusterLayer(map, orderData) {
  const sourceId = 'order_pointSource'
  const clusterLayerId = 'layer_order_cluster'
  const pointLayerId = 'layer_order_point'
  
  // 1. 创建聚类数据源
  map.addSource(sourceId, {
    type: 'geojson',
    data: formatOrderToGeoJSON(orderData),  // 将业务数据转为 GeoJSON
    cluster: true,
    clusterMaxZoom: 17,
    clusterRadius: 60,
    clusterProperties: {
      hasWarning: ['any', ['==', ['get', 'warningDegree'], '04']],
      total_count: ['+', 1]
    }
  })
  
  // 2. 创建聚合圆图层
  map.addLayer({
    id: clusterLayerId,
    type: 'symbol',
    source: sourceId,
    filter: ['has', 'point_count'],
    layout: {
      'icon-image': 'icon_cluster',
      'icon-size': 0.8,
      'text-field': ['to-string', ['get', 'point_count']],
      'text-size': 14
    }
  })
  
  // 3. 创建普通点图层
  map.addLayer({
    id: pointLayerId,
    type: 'symbol',
    source: sourceId,
    filter: ['!has', 'point_count'],
    layout: {
      'icon-image': ['match', ['get', 'iconIndex'],
        1, 'icon_order_normal',
        2, 'icon_order_warning',
        'icon_order_normal'
      ],
      'icon-size': 0.5,
      'icon-anchor': 'bottom'
    }
  })
  
  // 4. 聚合圆点击交互
  map.on('click', clusterLayerId, (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: [clusterLayerId]
    })
    if (!features.length) return
    
    const clusterId = features[0].properties.cluster_id
    map.getSource(sourceId).getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (!err) {
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: Math.min(zoom, 17)
        })
      }
    })
  })
  
  // 5. 普通点点击交互
  map.on('click', pointLayerId, (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: [pointLayerId]
    })
    if (features.length) {
      console.log('点击工单:', features[0].properties)
      // 弹出工单详情...
    }
  })
}
```

## 数据更新

聚类数据源支持动态更新数据，聚合会自动重新计算：

```javascript
// 当数据变化时，直接更新数据源
map.getSource('order_pointSource').setData({
  type: 'FeatureCollection',
  features: updatedFeatures
})
// clusterProperties 会自动重新聚合计算，无需额外操作
```

## 销毁聚类图层

```javascript
// 按正确顺序销毁：先图层，后数据源
function destroyClusterLayer(map, layerIds, sourceId) {
  layerIds.forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData({ type: 'FeatureCollection', features: [] })
    map.removeSource(sourceId)
  }
}

destroyClusterLayer(map, ['layer_order_cluster', 'layer_order_point'], 'order_pointSource')
```

::: tip 性能建议
1. **控制聚合半径**：`clusterRadius` 不宜过大（推荐 50-80px），否则大面积聚合失去意义
2. **合理设置 clusterMaxZoom**：接近城市/街道级别建议设为 15-17，再大就直接显示具体点位
3. **与 idle 事件配合**：当地图上有数千个点，使用 `idle` 事件配合 `queryRenderedFeatures` 只对可见点创建弹窗，避免一次性创建大量 Popup
4. **按需销毁**：切换到不相关的页面/模块时，及时销毁不再需要的聚类图层
:::