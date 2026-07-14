# 图上覆盖物及 Vue 组件交互

思极地图原生的 Popup 只支持 HTML/CSS 内容，但在实际项目中需要在弹窗中展示人员头像、工单列表、按钮操作等复杂交互。本章介绍如何在地图上渲染 Vue 组件弹窗，以及图标资源的动态管理。

## 原生 Popup 使用

思极地图通过 `SGMap.Popup` 创建弹窗：

```javascript
// 创建原生 Popup
const popup = new SGMap.Popup({
  closeButton: false,     // 是否显示关闭按钮
  closeOnClick: false,    // 是否点击地图时关闭
  anchor: 'bottom-left',  // 弹窗锚点位置（相对 lngLat 的方位）
  offset: [-32, 0],       // 偏移量 [x, y]，单位像素
  className: 'custom-popup'  // 自定义 CSS 类名
})

// 设置弹窗位置和内容
popup
  .setLngLat([116.397428, 39.90923])         // 设置位置
  .setHTML('<div class="popup">人员信息</div>')  // 方式1：设置 HTML 内容
  .setDOMContent(containerElement)            // 方式2：设置 DOM 节点
  .addTo(map)                                 // 添加到地图

// 移除弹窗
popup.remove()

// 监听弹窗事件
popup.on('close', () => {
  console.log('弹窗已关闭')
})
```

### 原生 Popup 的局限

| 局限 | 说明 |
|------|------|
| 只支持 HTML/CSS | 通过 `setHTML` 或 `setDOMContent` 设置内容 |
| 无法使用 Vue 响应式 | 弹窗内容写死，无法享受 Vue 的响应式更新 |
| 事件处理复杂 | 弹窗中的按钮事件需要通过全局函数处理 |
| 维护困难 | HTML 字符串拼接代码难以维护 |

## useRenderPopup — Vue 组件弹窗方案

将 Vue 组件渲染到 Popup DOM 容器中，从而在弹窗中使用完整的 Vue 能力：

### 实现原理

```
创建 SGMap.Popup → 创建 div 容器 → setDOMContent(div) → 将 Vue 组件挂载到 div → 监听 popup close 自动卸载
```

### 完整封装代码

```javascript
// useRenderPopup.js
import { renderDynamicComponent } from '@/utils/renderDynamicComponent'

export function useRenderPopup(
  sgMapInstance,    // 地图实例（浅层响应式）
  Component,        // Vue 组件
  lngLat,           // 经纬度（响应式 ref）
  offset = {},      // 偏移量
  props = {}        // 组件 props
) {
  // 1. 创建原生 SGMap.Popup 实例
  const popupDOM = new SGMap.Popup({
    closeButton: false,
    closeOnClick: false,
    anchor: 'bottom-left',
    offset
  })

  // 2. 创建容器 div
  const container = document.createElement('div')
  container.className = 'popup-render-root'

  // 3. 设置弹窗位置和内容
  popupDOM
    .setLngLat(lngLat.value)
    .setDOMContent(container)
    .addTo(sgMapInstance.value)

  // 4. 渲染 Vue 组件到容器
  let instance = null
  instance = renderDynamicComponent(Component, {
    ...props,
    container
  }, container)

  // 5. 监听 lngLat 变化，自动更新弹窗位置
  if (lngLat.value) {
    popupDOM.setLngLat(lngLat.value)
  }

  // 6. 监听 close 事件，自动卸载组件
  popupDOM.on('close', () => {
    if (instance?.unmount) {
      instance.unmount()
    }
    instance = null
  })

  return {
    popup: popupDOM,
    componentInstance: instance,
    
    // 移除 popup 并卸载组件
    remove() {
      if (instance?.unmount) {
        instance.unmount()
      }
      instance = null
      popupDOM.remove()
    },
    
    // 更新组件 props
    update(newProps) {
      if (instance?.update) {
        instance.update(newProps)
      }
    },
    
    // 替换渲染新组件
    renderInstance(NewComponent, newProps) {
      if (instance?.unmount) {
        instance.unmount()
      }
      instance = renderDynamicComponent(NewComponent, {
        ...newProps,
        container
      }, container)
    }
  }
}
```

### renderDynamicComponent 辅助函数

```javascript
// utils/renderDynamicComponent.js
import { createApp, h } from 'vue-demi'

/**
 * 将 Vue 组件动态渲染到指定 DOM 容器
 */
export function renderDynamicComponent(Component, props = {}, container) {
  if (!Component) {
    return null
  }
  
  // 创建 Vue 应用实例
  const app = createApp({
    render() {
      return h(Component, {
        ...props,
        container
      })
    }
  })
  
  // 挂载到容器
  app.mount(container)
  
  return {
    container,
    unmount() {
      app.unmount()
    },
    update(newProps) {
      // 通过修改响应式数据更新组件
      Object.assign(props, newProps)
    }
  }
}
```

#### 为什么使用 vue-demi

`renderDynamicComponent` 从 `vue-demi` 导入 `createApp` 和 `h`，而不是直接从 `vue` 导入。`vue-demi` 是一个 Vue 版本兼容层，它的核心作用是：

| 场景 | 说明 |
|------|------|
| **Vue 2.7 项目** | `vue-demi` 自动指向 `vue@2.7`，提供 `createApp` / `h` 等 Composition API |
| **Vue 3 项目** | `vue-demi` 自动指向 `vue@3`，行为与原生 `vue` 一致 |

**实际价值**：

```
使用 vue-demi 编写一次代码
├── 当前在 Vue 2.7 项目中运行 ✅
└── 将来升级到 Vue 3 时 → 无需修改这层代码 ✅
```

对于思极地图项目这种偏底层的地图封装工具，`renderDynamicComponent` 可能在多个 Vue 版本的项目间复用。使用 `vue-demi` 使得同一份代码在 Vue 2.7 和 Vue 3 中都能正常工作，平滑过渡未来的 Vue 升级迁移，避免工具层的二次改造。

### 使用示例

```javascript
// 在点击地图要素时弹出 Vue 组件弹窗
import { useRenderPopup } from '@/composables/useMap/useRenderPopup'
import PersonPopup from '@/components/popups/PersonPopup.vue'

map.on('click', 'personLayer', (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['personLayer']
  })
  
  if (features.length > 0) {
    const feature = features[0]
    const lngLat = {
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1]
    }
    
    // 创建 Vue 组件弹窗
    const popup = useRenderPopup(
      sgMapInstance,
      PersonPopup,                          // Vue 组件
      ref(lngLat),                          // 经纬度（响应式）
      { 'bottom-left': [-32, 0] },          // 偏移量
      {
        props: {
          personName: feature.properties.name,
          personStatus: feature.properties.status,
          headImage: feature.properties.headImage
        },
        nativeOn: {
          // 弹窗中按钮的事件处理
          onDetailClick: (person) => {
            console.log('查看详情:', person)
            // 跳转到详情页或打开抽屉
          },
          onCloseClick: () => {
            popup.remove()
          }
        }
      }
    )
  }
})
```

## 批量弹窗管理

当视口内有多个要素需要同时展示弹窗时，需要统一的弹窗管理机制。

### 为什么需要批量弹窗

思极地图原生的 Symbol 图层虽然可以通过 `text-field` 显示简单文字，但存在明显局限：

| 能力 | 原生 Symbol 图层 | Vue 组件弹窗 |
|------|-----------------|-------------|
| 样式复杂度 | 仅支持简单文字 + 图标 | 支持任意 HTML/CSS 布局 |
| 内容自由度 | 受限于表达式语法 | 完整的 Vue 响应式能力 |
| 多行排版 | 不支持复杂排版 | 支持 flex/grid 布局 |
| 动态数据 | 仅能从 properties 读取 | 可调用接口、计算属性 |
| 交互能力 | 仅 click 事件 | 按钮、表单、hover 全部支持 |

当业务需要在图上展示人员卡片（头像 + 姓名 + 状态 + 操作按钮）、工单详情（编号 + 类型 + 预警级别 + 进度条）等定制化高自由度的样式时，Symbol 图层无法满足需求，必须通过自定义 HTML（Vue 组件）实现。批量弹窗管理正是为了**在每个点上高效挂载定制化的 Vue 组件弹窗**。

```javascript
// 批量弹窗管理器
function createPopupManager(mapInstance) {
  const popups = []
  
  // 清理所有弹窗
  const removeAll = () => {
    popups.forEach(p => p.remove())
    popups.length = 0
  }
  
  // 根据 GeoJSON 数据重新渲染弹窗
  const reload = (geoJson, PopupComponent, callBack) => {
    removeAll()  // 先清理旧弹窗
    
    geoJson.features.forEach(feature => {
      const coordinates = feature.geometry.coordinates
      if (coordinates.length < 2) return
      
      const lngLat = ref({ lat: coordinates[1], lng: coordinates[0] })
      const popupType = feature.properties.popupType || 1
      const offset = popupType === 4 ? [-56, 0] : [-32, 0]
      
      const popup = useRenderPopup(
        mapInstance,
        PopupComponent,
        lngLat,
        { 'bottom-left': offset },
        {
          props: {
            ...feature.properties,
            popupType
          },
          nativeOn: {
            click: (item) => {
              // 重置所有弹窗状态
              geoJson.features.forEach(f => {
                if (f.properties.popupType === 2 || f.properties.popupType === 4) {
                  f.properties.popupType -= 1
                }
              })
              // 设置当前点击的弹窗为选中状态
              feature.properties.popupType += 1
              reload(geoJson, PopupComponent, callBack)  // 重新渲染
              
              if (feature) callBack(feature)
            }
          }
        }
      )
      popups.push(popup)
    })
  }
  
  return { reload, removeAll }
}
```

### 配合 idle 事件使用

批量弹窗管理器通常与 `idle` 事件配合，只在视口变化后刷新可见弹窗：

```javascript
const popupManager = createPopupManager(map)

// 视口变化后刷新弹窗
map.on('idle', () => {
  // 获取当前视口内可见的要素
  const features = map.queryRenderedFeatures({
    layers: ['pointLayer']
  })
  
  if (features.length > 0) {
    const geoJson = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { ...f.properties, popupType: 1 }
      }))
    }
    popupManager.reload(geoJson, PointPopup, (feature) => {
      console.log('弹窗点击:', feature.properties)
    })
  } else {
    popupManager.removeAll()
  }
})
```

### idle 事件详解

`idle` 是思极地图中最适合用于"视口变化后刷新可见数据"的事件。理解它需要先区分几个相似的视口事件：

| 事件 | 触发时机 | 渲染完成 | 适用场景 |
|------|----------|----------|----------|
| `move` | 地图开始移动时 | ❌ 立即触发，渲染未完成 | 移动开始时的 UI 响应（如 loading） |
| `moveend` | 地图停止移动时 | ❌ 移动停止即触发，瓦片/图层可能还在加载 | 记录日志、更新 URL 状态 |
| **`idle`** | 地图**完全空闲**时 | ✅ 所有瓦片加载完毕、所有图层渲染完成 | **查询渲染要素、刷新弹窗** |

```
用户拖动地图 → move → moveend → 瓦片加载 → 图层渲染 → idle
                                         ↑              ↑
                                    queryRenderedFeatures  此时查询
                                    在这里查询可能拿不到    可以拿到最新渲染结果
                                    最新渲染的要素          
```

**为什么弹窗刷新必须用 idle**：

`queryRenderedFeatures` 返回的是已渲染到屏幕的要素。如果地图移动刚结束（`moveend`），瓦片或图层可能还在加载中，此时查询会漏掉尚未渲染完成的要素。`idle` 确保所有瓦片和图层都已渲染完毕，`queryRenderedFeatures` 能拿到完整准确的结果。

::: tip 为什么用 idle 而不在渲染时创建所有弹窗
当数据量大时（几千个点），一次性为所有点创建 Popup 会导致 DOM 节点过多、页面卡顿。配合 `idle` + `queryRenderedFeatures`，只对当前视口内的可见点创建弹窗，性能更优。
:::

## 图标资源管理

思极地图的 Symbol 图层需要使用图标（`icon-image`），项目中使用 `styleimagemissing` 事件实现按需加载：

```javascript
// 图标配置
const ICON_LIST = [
  { name: 'icon_person_online', iconUrl: '/icons/person_online.png' },
  { name: 'icon_person_working', iconUrl: '/icons/person_working.png' },
  { name: 'icon_person_offline', iconUrl: '/icons/person_offline.png' },
  { name: 'icon_order_normal', iconUrl: '/icons/order_normal.png' },
  { name: 'icon_order_warning', iconUrl: '/icons/order_warning.png' },
  { name: 'icon_cluster', iconUrl: '/icons/cluster.png' },
  { name: 'icon-line-route', iconUrl: '/icons/line_route.png' }
]

// 图标缺失时按需加载
map.on('styleimagemissing', (e) => {
  const imageId = e.id
  
  // 避免重复加载
  if (map.hasImage(imageId)) return
  
  // 1. 从本地图标库查找
  const iconObj = ICON_LIST.find(v => v.name === imageId)
  let url = iconObj?.iconUrl
  
  // 2. 本地未找到，尝试远程 URL（如头像）
  if (!url) {
    url = imageId.startsWith('http') 
      ? imageId 
      : `${baseUrl}/${imageId}`
  }
  
  // 3. 加载并注册图标
  map.loadImage(url, (err, img) => {
    if (err) {
      console.warn('图标加载失败:', imageId, err)
      return
    }
    if (!map.hasImage(imageId)) {
      map.addImage(imageId, img, {
        width: 200,
        height: 200,
        sdf: false  // 非 SDF 图标
      })
    }
  })
})
```

### loadImage 预加载 vs styleimagemissing 按需加载

思极地图提供了两种图标加载方式，它们的区别不仅在于"何时加载"，更在于工作流程和适用场景的根本不同：

#### 方式一：map.loadImage — 主动预加载

在图层创建之前，开发者明确知道需要哪些图标，**主动调用** `map.loadImage` + `map.addImage` 提前注册图标：

```javascript
// 地图加载完成后，预加载所有可能需要的图标
map.on('load', () => {
  const iconList = [
    { id: 'icon_person_online', url: '/icons/online.png' },
    { id: 'icon_person_offline', url: '/icons/offline.png' },
    { id: 'icon_order_normal', url: '/icons/order.png' }
  ]
  
  iconList.forEach(icon => {
    map.loadImage(icon.url, (err, img) => {
      if (!err && !map.hasImage(icon.id)) {
        map.addImage(icon.id, img)
      }
    })
  })
})
```

#### 方式二：styleimagemissing — 被动按需加载

**不提前加载任何图标**。当 Symbol 图层引用了一个不存在的图标时，SDK 自动触发 `styleimagemissing` 事件，在此事件回调中再去加载：

```javascript
// 注册全局图标缺失处理（懒加载）
map.on('styleimagemissing', (e) => {
  const imageId = e.id
  // 从本地图标库或远程 URL 找到对应图标并加载
  // ... （详见上方完整代码）
})
```

#### 两种方式对比

| 维度 | `loadImage` 预加载 | `styleimagemissing` 按需加载 |
|------|-------------------|---------------------------|
| **触发方式** | 开发者主动调用 | SDK 自动触发（图标缺失时） |
| **加载时机** | 图层创建之前 | 图层首次渲染、发现图标缺失时 |
| **首次显示** | 图标立即可用，无延迟 | 首次渲染可能延迟 100-300ms（网络请求） |
| **首次加载耗时** | 慢（需加载全部预定义图标，3-5s） | 快（只加载当前视口实际用到的图标） |
| **带宽消耗** | 高（加载了可能不会用到的图标） | 低（只加载实际被渲染的图标） |
| **动态图标** | 需要提前知道所有图标 ID，动态 URL 不便处理 | 天然支持动态 URL（如远程头像），可在事件中动态拼装 |
| **适用场景** | 图标种类少（<5种）、确定会用到的固定图标 | 图标种类多（10+种）、不同场景用不同子集、有动态远程图标 |

::: tip 推荐按需加载（styleimagemissing）
对于思极地图常见的业务场景（人员状态 10+ 种图标、工单类型 10+ 种图标、聚合图标、动态头像 URL 等），图标种类繁多且不同页面使用不同子集，`styleimagemissing` 按需加载是更优选择——100ms 的首次图标延迟远优于 3s 的预加载等待。只有当图标种类极少且确定全部会用到时，才考虑 `loadImage` 预加载。
:::

## 综合示例：完整的弹窗+图标交互

```javascript
async function initCompleteMapInteraction() {
  const map = sgMapInstance.value
  
  // 1. 注册图标按需加载
  map.on('styleimagemissing', handleIconMissing)
  
  // 2. 创建人员数据源和图层
  map.addSource('personSource', { type: 'geojson', data: personGeoJSON })
  map.addLayer({
    id: 'personLayer',
    type: 'symbol',
    source: 'personSource',
    layout: {
      'icon-image': ['match', ['get', 'iconIndex'], 1, 'icon_person_online', 'icon_person_offline'],
      'icon-size': 0.5,
      'icon-anchor': 'bottom'
    }
  })
  
  // 3. 批量弹窗管理
  const popupManager = createPopupManager(map)
  
  // 4. 视口变化时刷新弹窗
  map.on('idle', () => {
    const features = map.queryRenderedFeatures({ layers: ['personLayer'] })
    if (features.length > 0) {
      popupManager.reload(
        { type: 'FeatureCollection', features },
        PersonPopupComponent,
        onPopupClick
      )
    } else {
      popupManager.removeAll()
    }
  })
  
  // 5. 清理
  return () => {
    popupManager.removeAll()
    map.off('styleimagemissing', handleIconMissing)
    map.off('idle', /* ... */)
  }
}
```
