# 业务数据回显图上打点

将后端返回的业务数据（人员、工单、设备等）在地图上可视化展示，是思极地图最常见的应用场景。本章介绍如何将不同格式的业务数据转换并渲染到地图上。

## 数据流转流程

```
后端业务数据 → 格式转换(GEOJSON) → 创建数据源 → 添加图层 → 绑定交互 → 动态更新
```

## 业务数据转 GeoJSON

思极地图的矢量图层需要 GeoJSON 格式的数据。业务数据通常从后端 API 获取，需要转换为标准 GeoJSON：

### 人员数据转 GeoJSON

```javascript
// 从后端获取的人员数据
const personData = [
  {
    id: 1001,
    name: '张三',
    lng: 116.397428,
    lat: 39.90923,
    status: 1,       // 状态：1-在岗, 2-作业中, 3-离线
    headImage: 'avatar/1001.jpg',
    phone: '13800138000'
  },
  // ...更多人员
]

// 转为 GeoJSON
function formatPersonToGeoJSON(personData) {
  return {
    type: 'FeatureCollection',
    features: personData.map(p => ({
      type: 'Feature',
      id: p.id,  // 纯数字 ID
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat]
      },
      properties: {
        name: p.name,
        iconIndex: p.status,     // 用于动态匹配图标
        headImage: p.headImage,  // 用于头像图层
        phone: p.phone,
        // ...其他业务属性
      }
    }))
  }
}
```

### 工单数据转 GeoJSON

```javascript
// 工单数据
const orderData = [
  {
    id: 'WO2023001',
    lng: 116.40,
    lat: 39.91,
    type: 'repair',       // 工单类型
    warningDegree: '04',  // 预警级别
    description: '线路检修'
  }
]

// 转为 GeoJSON
function formatOrderToGeoJSON(orderData) {
  return {
    type: 'FeatureCollection',
    features: orderData.map(o => ({
      type: 'Feature',
      id: o.id,  // 注意：纯字符串 ID
      geometry: {
        type: 'Point',
        coordinates: [o.lng, o.lat]
      },
      properties: {
        iconIndex: getOrderIconIndex(o.type),  // 根据类型映射图标索引
        warningDegree: o.warningDegree,
        description: o.description
      }
    }))
  }
}

// 工单类型 → 图标索引映射
function getOrderIconIndex(type) {
  const mapping = {
    'repair': 1,        // 检修
    'patrol': 2,        // 巡视
    'emergency': 3      // 抢修
  }
  return mapping[type] || 1
}
```

### 区域边界数据转 GeoJSON

区域边界数据有两种来源，需要根据业务场景选择合适的方式。

#### 方式一：官方行政区划数据（公共资源）

思极地图通过 `DistrictPlusTask` 插件提供了标准行政区划边界查询能力，适用于展示省/市/区县等公共行政区域：

```javascript
// 行政区划数据（从 DistrictPlusTask 查询获取——仅限标准行政区域）
const districtData = await window.districtPlusTask.searchDistrict('110000')

// 转为 GeoJSON（面和线）
function formatDistrictToGeoJSON(districtData) {
  const features = []
  const list = districtData.sub_districts || []
  
  list.forEach((item, index) => {
    features.push({
      type: 'Feature',
      id: item.adcode || index,
      geometry: item.shape,  // 直接使用 shape 字段（已为 GeoJSON geometry）
      properties: {
        name: item.name,
        adcode: item.adcode,
        color: '#68AFB0',
        lineType: 'solid'    // solid 或 dashed
      }
    })
  })
  
  return {
    type: 'FeatureCollection',
    features
  }
}
```

::: warning 仅限标准行政区划
`searchDistrict()` 获取的是国家标准的行政区划边界数据（省/市/区县），属于公共资源。它**无法**提供业务自定义区域（如巡检片区、自定义网格等）的边界。
:::

#### 方式二：业务自定义区域数据（个性化数据）

对于巡检片区、自定义网格等业务个性化区域，需要**自行制作 GeoJSON 数据**。常见流程如下：

```
使用绘图工具制图 → 导出 GeoJSON → 存入业务方数据库 → 后端接口返回 → 前端渲染到地图
```

**数据制作建议**：

| 步骤 | 说明 | 工具推荐 |
|------|------|----------|
| 1. 绘制区域 | 在地图上绘制自定义多边形/多面体区域 | 思极地图 `DrawPolygonHandler` 插件、QGIS、geojson.io |
| 2. 导出数据 | 将绘制的区域导出为标准 GeoJSON 格式 | 上述工具均支持 GeoJSON 导出 |
| 3. 存入数据库 | 将 GeoJSON 存入业务方数据库（如 MySQL JSON 字段、MongoDB 等） | 由业务后端处理 |
| 4. 接口返回 | 前端通过业务接口获取已存储的 GeoJSON 数据 | — |
| 5. 渲染到地图 | 将获取到的 GeoJSON 通过 `addSource` + `addLayer` 渲染 | 见 [矢量图层](../Initialization/vectorLayer.md) |

```javascript
// 示例：从业务后端获取自定义区域并渲染
async function loadCustomArea(areaId) {
  // 从业务方数据库获取个性化 GeoJSON 数据
  const res = await fetch(`/api/custom-areas/${areaId}`)
  const areaGeoJSON = await res.json()
  
  // 与普通 GeoJSON 一样渲染
  map.addSource(`custom_area_source_${areaId}`, {
    type: 'geojson',
    data: areaGeoJSON
  })
  
  map.addLayer({
    id: `custom_area_layer_${areaId}`,
    type: 'fill',
    source: `custom_area_source_${areaId}`,
    paint: {
      'fill-color': '#D7F3EF',
      'fill-opacity': 0.8
    }
  })
}
```

## 完整的上图流程

以「在街道地图上展示人员位置和头像」为例，展示完整的数据回显流程：

```javascript
// components/pages/personView/PersonMap.vue
import { shallowRef, ref } from 'vue'

const sgMapInstance = shallowRef(null)

// 步骤 1：初始化地图
async function initMap() {
  await SGMap.tokenTask.login(appkey, appsecret)
  await SGMap.plugin(['SGMap.DistrictPlusTask', 'SGMap.GeolocationTask'])
  
  const map = new SGMap.Map({
    container: 'sgMap',
    style: 'aegis://styles/aegis/Streets-v2',
    zoom: 12,
    center: [116.397428, 39.90923]
  })
  
  map.on('load', () => {
    sgMapInstance.value = map
    // 加载图标资源
    map.on('styleimagemissing', handleIconMissing)
    // 加载人员数据
    loadPersonData()
  })
}

// 步骤 2：加载并转换数据
async function loadPersonData() {
  const map = sgMapInstance.value
  if (!map) return
  
  // 从后端获取人员数据
  const persons = await fetch('/api/persons')
  const geoJSON = formatPersonToGeoJSON(persons)
  
  // 步骤 3：创建数据源
  const sourceId = 'person_pointSource'
  
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      data: geoJSON
    })
  } else {
    map.getSource(sourceId).setData(geoJSON)
  }
  
  // 步骤 4：创建图标图层
  if (!map.getLayer('person_icon_layer')) {
    map.addLayer({
      id: 'person_icon_layer',
      type: 'symbol',
      source: sourceId,
      filter: ['!has', 'point_count'],
      layout: {
        'icon-image': [
          'match',
          ['get', 'iconIndex'],
          1, 'icon_person_online',
          2, 'icon_person_working',
          3, 'icon_person_offline',
          'icon_person_online'
        ],
        'icon-size': 0.5,
        'icon-anchor': 'bottom'
      },
      paint: {
        'icon-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          1,    // 选中时不透明
          0.85  // 默认略透明
        ]
      }
    })
  }
  
  // 步骤 5：创建头像图层
  if (!map.getLayer('person_head_layer')) {
    map.addLayer({
      id: 'person_head_layer',
      type: 'symbol',
      source: sourceId,
      filter: ['!has', 'point_count'],
      layout: {
        'icon-image': [
          'case',
          ['all', ['has', 'headImage'], ['!=', ['get', 'headImage'], '']],
          ['concat', 'https://example.com/', ['get', 'headImage']],
          ''
        ],
        'icon-offset': [0, -100],
        'icon-size': 0.186
      }
    })
  }
  
  // 步骤 6：绑定点击事件
  map.on('click', 'person_icon_layer', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['person_icon_layer']
    })
    if (features.length > 0) {
      const person = features[0].properties
      console.log('点击人员:', person.name)
      // 弹出人员详情弹窗
      showPersonPopup(person, features[0].geometry.coordinates)
    }
  })
}

// 步骤 7：数据更新（如定时刷新人员位置）
setInterval(async () => {
  const map = sgMapInstance.value
  if (!map) return
  
  const persons = await fetch('/api/persons/latest')
  const geoJSON = formatPersonToGeoJSON(persons)
  
  const source = map.getSource('person_pointSource')
  if (source) {
    source.setData(geoJSON)  // 只更新数据，无需重建图层
  }
}, 30000)  // 30秒刷新一次
```

## 数据更新模式

### 全量更新

适用于数据量不大、变化频繁的场景：

```javascript
function refreshAllData(map, newData) {
  const source = map.getSource('dataSource')
  if (source) {
    source.setData(formatToGeoJSON(newData))
  }
}
```

### 增量更新

适用于只改变部分数据的场景，先获取当前数据，合并后再更新：

```javascript
function updateSinglePoint(map, sourceId, updatedItem) {
  const source = map.getSource(sourceId)
  if (!source) return
  
  // 获取当前数据
  const currentData = source._data  // 或维护一份本地数据副本
  
  // 找到并更新对应项
  const idx = currentData.features.findIndex(f => f.id === updatedItem.id)
  if (idx !== -1) {
    currentData.features[idx] = {
      ...currentData.features[idx],
      geometry: {
        type: 'Point',
        coordinates: [updatedItem.lng, updatedItem.lat]
      },
      properties: { ...currentData.features[idx].properties, ...updatedItem }
    }
    source.setData(currentData)
  }
}
```

### 数据筛选回显

根据业务筛选条件动态更新地图显示：

```javascript
function filterMapData(map, sourceId, allData, filterFn) {
  const source = map.getSource(sourceId)
  if (!source) return
  
  // 根据条件筛选
  const filteredFeatures = allData.features.filter(filterFn)
  
  source.setData({
    type: 'FeatureCollection',
    features: filteredFeatures
  })
}

// 使用示例：只显示在岗人员
filterMapData(map, 'person_pointSource', allPersonData, (f) => {
  return f.properties.status === 1
})
```

## 性能优化建议

::: tip 大量点位的性能优化
1. **使用聚类图层**：当点位超过 500 个时，建议开启聚类（`cluster: true`）
2. **按需创建弹窗**：配合 `idle` 事件 + `queryRenderedFeatures`，只为视口内的点创建弹窗
3. **避免频繁 setData**：批量更新优于逐条更新，可以加入防抖或节流
4. **分离数据与渲染**：本地维护完整数据副本，按需更新地图
5. **按需加载图标**：使用 `styleimagemissing` 事件而非预加载所有图标
:::