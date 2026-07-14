# 图上鼠标事件

思极地图提供了丰富的事件系统，支持对地图本身、图层以及要素的点击、悬浮等交互。本章介绍如何区分单击/双击、右键菜单、悬浮高亮等常用交互场景。

## 单击与双击区分

### 问题背景

思极地图 SDK 中 `dblclick` 事件在部分版本中不生效或不稳定，无法可靠地监听双击。因此项目中采用手动方案区分单击和双击。

### 实现方案

使用 `clickCount` 计数器 + `setTimeout` 500ms 延迟区分单击/双击：

```javascript
// useMapEvents.js
let clickCount = 0
let clickTimer = null

map.on('click', (e) => {
  clickCount++
  e.clickType = 1  // 默认为单击
  clearTimeout(clickTimer)
  
  clickTimer = setTimeout(() => {
    if (clickCount >= 2) {
      // 双击
      e.clickType = 2
      handleDoubleClick(e)
    } else if (clickCount === 1) {
      // 单击
      if (e.features?.length) {
        handleFeatureClick(e)   // 点击了要素
      } else {
        handleBlankClick(e)     // 点击了空白处
      }
    }
    clickCount = 0
  }, 500)
})
```

::: tip 为什么是 500ms
500ms 是用户体验和响应速度之间的平衡点。太短容易误判双击，太长会让单击响应显得迟钝。
:::

## 图层点击事件

可以为特定图层绑定点击事件，获取被点击的要素信息：

```javascript
// 监听面图层的点击
map.on('click', 'polygonLayer', (e) => {
  // 获取点击位置的渲染要素
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['polygonLayer']
  })
  
  if (features.length > 0) {
    const clickedFeature = features[0]
    console.log('点击的要素:', clickedFeature)
    console.log('要素属性:', clickedFeature.properties)
    console.log('几何类型:', clickedFeature.geometry.type)
    console.log('坐标:', clickedFeature.geometry.coordinates)
  }
})

// 监听点图层的点击
map.on('click', 'pointLayer', (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['pointLayer']
  })
  
  if (features.length > 0) {
    showPopup(features[0])  // 弹出详情弹窗
  }
})
```

### queryRenderedFeatures — 查询渲染要素

`queryRenderedFeatures` 是点击事件中最常用的 API，用于获取当前渲染在屏幕上的要素。支持三种查询方式：

#### 方式一：像素点查询

```javascript
// 查询鼠标位置的要素
map.on('click', (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['polygonLayer']
  })
})
```

#### 方式二：矩形范围查询

```javascript
// 查询指定像素区域的要素（常用于拖拽等场景）
const pointWithBuffer = [
  [e.point.x + 10, e.point.y + 40],   // 左下角
  [e.point.x - 80, e.point.y - 10]     // 右上角
]

const features = map.queryRenderedFeatures(pointWithBuffer, {
  layers: ['pointLayer']
})
```

#### 方式三：视口查询（不传坐标）

```javascript
// 查询当前视口内指定图层的全部渲染要素
const features = map.queryRenderedFeatures({
  layers: ['pointLayer']
})
```

| 查询方式 | 参数 | 说明 |
|----------|------|------|
| 像素点查询 | `[x, y]` + `{ layers }` | 查询指定像素坐标的要素 |
| 矩形范围查询 | `[[x1, y1], [x2, y2]]` + `{ layers }` | 查询矩形范围内要素 |
| 视口查询 | `{ layers }`（无坐标） | 查询视口内所有渲染要素 |

## 右键菜单（ContextMenu）

```javascript
// 全局右键事件
map.on('contextmenu', (e) => {
  console.log('右键点击位置:', e.lngLat)
  // 弹出全局右键菜单
  showContextMenu(e.lngLat, [
    { label: '回到默认视角', action: () => resetMapView() },
    { label: '添加标记', action: () => addMarker(e.lngLat) }
  ])
})

// 图层级别的右键事件
map.on('contextmenu', 'polygonLayer', (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['polygonLayer']
  })
  if (features.length) {
    console.log('右键点击了区域:', features[0].properties)
    // 弹出区域相关右键菜单
    showAreaContextMenu(e.lngLat, features[0])
  }
})
```

### 右键事件典型场景

| 场景 | 说明 |
|------|------|
| 右键空白处 | 显示全局菜单（重置视角、添加标记等） |
| 右键区域/面 | 显示区域操作选项（查看属性、导出数据、展开详情） |
| 右键聚合圆 | 展开聚合、查看统计信息 |
| 右键标记点 | 删除标记、修改信息、导航到该点 |

## 悬浮事件（MouseEnter / MouseLeave / MouseMove）

悬浮交互是实现要素高亮效果的核心：

```javascript
let hoveredId = null

// 鼠标移入图层要素
map.on('mousemove', 'polygonLayer', (e) => {
  // 改变鼠标样式
  map.getCanvas().style.cursor = 'pointer'
  
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['polygonLayer']
  })
  
  if (features.length > 0) {
    const newId = features[0].id
    
    // 只在切换要素时才更新状态
    if (newId !== hoveredId) {
      // 清除旧要素的高亮状态
      if (hoveredId) {
        map.setFeatureState(
          { source: 'polygonSource', id: hoveredId },
          { hover: false }
        )
      }
      
      // 设置新要素的高亮状态
      hoveredId = newId
      map.setFeatureState(
        { source: 'polygonSource', id: hoveredId },
        { hover: true }
      )
    }
  }
})

// 鼠标离开图层
map.on('mouseleave', 'polygonLayer', () => {
  // 恢复鼠标样式
  map.getCanvas().style.cursor = ''
  
  // 清除高亮状态
  if (hoveredId) {
    map.setFeatureState(
      { source: 'polygonSource', id: hoveredId },
      { hover: false }
    )
    hoveredId = null
  }
})
```

### 悬浮事件性能优化

::: tip 关键优化：只在切换要素时更新
`mousemove` 每秒可能触发数十次。在回调中应该先判断当前要素 ID 是否与上一个相同，只有切换要素时才执行 `setFeatureState`，避免不必要的状态更新。
:::

## 事件解绑

组件卸载或切换页面时，务必解绑事件防止内存泄漏：

```javascript
// 使用具名函数（不能用匿名函数，否则无法解绑）
const handleClick = (e) => { /* ... */ }
const handleMouseMove = (e) => { /* ... */ }

// 绑定
map.on('click', 'myLayer', handleClick)
map.on('mousemove', 'myLayer', handleMouseMove)

// 解绑（组件卸载时）
function cleanup() {
  map.off('click', 'myLayer', handleClick)
  map.off('mousemove', 'myLayer', handleMouseMove)
}
```

::: warning 必须使用具名函数
`map.off()` 需要传入与 `map.on()` **完全相同的函数引用**才能正确解绑。匿名函数无法解绑！
:::

## 事件速查表

| 事件 | 说明 | 使用场景 |
|------|------|----------|
| `load` | 地图加载完成 | 初始化操作（添加图层、设置默认视图） |
| `click` | 单击地图/图层 | 要素选择、弹出详情 |
| `dblclick` | 双击（不可靠，建议手动实现） | 定位放大 |
| `contextmenu` | 右键点击 | 右键菜单 |
| `mousemove` | 鼠标移动 | 悬浮高亮、Tooltip |
| `mouseenter` | 鼠标进入图层要素 | 高亮交互 |
| `mouseleave` | 鼠标离开图层要素 | 清除高亮、恢复样式 |
| `idle` | 地图空闲（渲染完成） | 视口变化后刷新可见数据 |
| `styleimagemissing` | 图标缺失 | 按需加载图标 |
| `zoom` | 缩放级别变化 | 根据缩放级别切换显示 |