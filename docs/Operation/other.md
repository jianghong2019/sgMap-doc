# 其他图上交互事件

本章介绍视图控制、缩放、定位、飞行等与地图视口和交互状态相关的功能。

## 视图控制概述

思极地图提供了三种视图移动 API，适用不同场景：

| API | 特点 | 适用场景 |
|-----|------|----------|
| `flyTo()` | 飞行动画，带有抛物线弧线效果 | 从一个位置飞到另一个位置，大跨度移动 |
| `easeTo()` | 缓动动画，直线平滑移动 | 聚合展开、地图内小幅移动 |
| `fitBounds()` | 自适应边界框，自动计算最佳视图 | 缩放到能完整显示一组要素 |

## flyTo — 飞行动画

从一个位置飞到另一个位置，带有弧线飞行效果，适合大跨度移动：

```javascript
// 基本用法
map.flyTo({
  center: [116.397428, 39.90923],  // 目标中心点
  zoom: 14,                         // 目标缩放级别
  duration: 1000,                   // 动画时长（毫秒）
  easing(t) {                       // 缓动函数（可选）
    console.log('进度:', t)         // t 从 0 到 1
    return t
  }
})
```

### 封装同步和异步两种方式

项目中封装了同步和异步两个版本，分别适用不同场景：

```javascript
// 同步版本 — 通过 easing 回调跟踪进度
const flyTo = ({ center, zoom = 16 }, callback) => {
  map?.flyTo({
    center,
    zoom,
    duration: 1000,
    easing(t) {
      callback?.(t)  // 动画进度回调 (0 → 1)
      return t
    }
  })
}

// 异步版本 — await 等待动画完成
const flyToAsync = ({ center, zoom = 16 }) => {
  return new Promise((resolve) => {
    map?.flyTo({ center, zoom, duration: 1000 })
    
    // 方案一：用 setTimeout 等待动画结束
    setTimeout(() => {
      resolve({
        center: map?.getCenter(),
        zoom: map?.getZoom(),
        message: 'flyTo 执行完成'
      })
    }, 1000)
    
    // 方案二（推荐）：用 moveend 事件监听动画结束
    // map?.once('moveend', () => {
    //   resolve({
    //     center: map?.getCenter(),
    //     zoom: map?.getZoom()
    //   })
    // })
  })
}
```

### 使用对比

```javascript
// flyTo — 同步，不阻塞后续代码
flyTo({ center: [116, 39], zoom: 12 }, (t) => {
  console.log('飞行进度:', t)
})
console.log('动画进行中...')  // 立即执行

// flyToAsync — 异步，等待动画完成
await flyToAsync({ center: [116, 39], zoom: 12 })
console.log('动画已完成')  // 完成后才执行
```

## easeTo — 缓动移动

直线平滑移动，没有弧线效果，适合小幅调整：

```javascript
// 聚合展开时使用 easeTo
map.easeTo({
  center: [116.397428, 39.90923],
  zoom: 15,
  duration: 500
})

// 平移地图（不改变缩放）
map.easeTo({
  center: [117.2, 39.1],
  duration: 300
})
```

## fitBounds — 自适应边界

自动计算最佳缩放级别和中心点，确保一组要素完整显示在地图视口内：

```javascript
// 基本用法
map.fitBounds(
  [[minLng, minLat], [maxLng, maxLat]],  // 西南角和东北角坐标
  {
    padding: 50,     // 内边距（像素）
    maxZoom: 16,     // 最大缩放级别
    duration: 800    // 动画时长
  }
)
```

### 配合 Turf.js 计算边界框

```javascript
import { featureCollection } from '@turf/turf'
import { bbox } from '@turf/bbox'

const fitBounds = async (features, options = {}) => {
  const padding = options?.padding ?? 50
  
  // 1. 将 Feature 数组转为 FeatureCollection
  const points = featureCollection(features)
  
  // 2. 自动计算边界框 [minLng, minLat, maxLng, maxLat]
  const box = bbox(points)
  
  // 3. 自适应视图
  map?.fitBounds(box, {
    padding,
    maxZoom: options?.maxZoom ?? 16,
    duration: options?.duration ?? 800
  })
}

// 使用示例
fitBounds(personFeatures, { padding: 80, maxZoom: 18 })
```

::: tip 为什么用 Turf.js
手动遍历 features 提取坐标、比较 min/max 计算边界框，代码冗长且容易出错。Turf.js 的 `featureCollection` + `bbox` 两行代码即可完成，并自动处理空数组、单点等边界情况。
:::

## 缩放控制

### 程序化缩放

```javascript
// 放大一级
map.zoomIn({ duration: 300 })

// 缩小一级
map.zoomOut({ duration: 300 })

// 缩放到指定级别
map.zoomTo(14, { duration: 500 })

// 获取当前缩放级别
const currentZoom = map.getZoom()  // 返回数字，如 12.5

// 监听缩放变化
map.on('zoom', () => {
  const zoom = map.getZoom()
  console.log('当前缩放级别:', zoom.toFixed(2))
  
  // 根据缩放级别动态切换图层显隐
  if (zoom > 14) {
    map.setLayoutProperty('detailLayer', 'visibility', 'visible')
  } else {
    map.setLayoutProperty('detailLayer', 'visibility', 'none')
  }
})
```

### 初始化时的缩放配置

```javascript
const map = new SGMap.Map({
  container: 'sgMap',
  style: 'aegis://styles/aegis/Streets-v2',
  zoom: 9,                    // 初始缩放级别
  minZoom: 3,                 // 最小缩放级别（限制缩小范围）
  maxZoom: 20,                // 最大缩放级别（限制放大范围）
  doubleClickZoom: false,     // 禁止双击缩放
  scrollZoom: true,           // 是否允许滚轮缩放
  touchZoomRotate: true       // 是否允许触摸手势缩放
})
```

## 地图拖动与维度限制

### 限制地图可拖动范围

```javascript
// 设置地图的最大边界（用户无法拖出此范围）
map.setMaxBounds([
  [73.0, 18.0],   // 西南角 [lng, lat]
  [135.0, 53.0]   // 东北角 [lng, lat]
])

// 取消边界限制
map.setMaxBounds(null)
```

### 获取当前视图信息

```javascript
// 获取当前中心点
const center = map.getCenter()  // { lng: 116.397, lat: 39.909 }

// 获取当前可视范围
const bounds = map.getBounds()
// bounds.getSouthWest() → 西南角 { lng, lat }
// bounds.getNorthEast() → 东北角 { lng, lat }

// 获取当前缩放级别
const zoom = map.getZoom()
```

## 容器尺寸变化

当地图容器大小发生变化时（如侧边栏展开/收起），需要通知地图重新计算尺寸：

```javascript
// 手动触发 resize
map.resize()

// 配合 ResizeObserver 自动监听
const resizeObserver = new ResizeObserver(() => {
  map.resize()
})
resizeObserver.observe(map.getContainer())

// 组件销毁时取消监听
// resizeObserver.disconnect()
```

## idle 事件 — 视口变化后刷新数据

`idle` 事件在地图渲染完成后触发，是视口变化后刷新可见范围数据的理想时机：

```javascript
map.on('idle', () => {
  // 1. 获取当前视口内渲染的点
  const features = map.queryRenderedFeatures({
    layers: ['pointLayer']
  })
  
  if (features.length > 0) {
    // 2. 只为可见点创建弹窗，而不是所有点
    const visiblePoints = features.map(f => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: f.properties
    }))
    
    // 3. 重新渲染弹窗
    reloadMapPopup({
      type: 'FeatureCollection',
      features: visiblePoints
    })
  } else {
    // 4. 视口内无点，清除弹窗
    removeMapPopup()
  }
})
```

::: tip 为什么用 idle 而不是 moveend
- `moveend`：地图停止移动时触发，但渲染可能尚未完成
- `idle`：地图渲染完成后才触发，此时 `queryRenderedFeatures` 能获取到最新的渲染要素
- 对于需要查询渲染要素的场景，`idle` 是更可靠的选择
:::

## 综合示例：定位到指定点并高亮

```javascript
async function locateAndHighlight(feature) {
  // 1. 飞行到目标位置
  await flyToAsync({
    center: feature.geometry.coordinates,
    zoom: 16
  })
  
  // 2. 高亮目标要素
  map.setFeatureState(
    { source: 'pointSource', id: feature.id },
    { selected: true }
  )
  
  // 3. 弹出详情
  showPopup(feature)
  
  // 4. 3秒后取消高亮
  setTimeout(() => {
    map.setFeatureState(
      { source: 'pointSource', id: feature.id },
      { selected: false }
    )
  }, 3000)
}
```