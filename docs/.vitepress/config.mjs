import { defineConfig } from 'vitepress'
export default defineConfig({
  title: "The SgMap Docs",
  description: "How To Use The SgMap",
  themeConfig: {
    nav: [
      { text: '指南', link: '/' },
      { text: '文档', link: '/Initialization/initialization' }
    ],

    sidebar: [
      {
        text: '基础概念',
        link: '/introduction.md'
      },
      {
        text: '地图初始化及图层管理',
        items: [
          { text: '初始化及默认数据设置', link: '/Initialization/initialization.md' },
          { text: '矢量图层', link: '/Initialization/vectorLayer.md' },
          { text: '聚类图层', link: '/Initialization/clusterLayer.md' },
          { text: '背景图层', link: '/Initialization/bgLayer.md' }
        ]
      },
      {
        text: '数据可视化',
        items: [
          { text: '业务数据回显图上打点', link: '/Visualization/echo' },
          { text: '业务数据交互', link: '/Visualization/interaction' },
          { text: '图上覆盖物及vue组件交互', link: '/Visualization/operation' }
        ]
      },
      {
        text: '交互事件',
        items: [
          { text: '点击事件', link: '/Operation/clickEvent' },
          { text: '缩放、视角、定位等', link: '/Operation/other' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jianghong2019/sgMap-doc' }
    ]
  }
})
