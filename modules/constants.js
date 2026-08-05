// ========== 默认数据 ==========
const FAV_CAT_ID = -1;
const UNCAT_ID = -2; // 未分类（孤儿标签收容所，固定不可删）
const SCHEMA_VERSION = 2;
// 两层本体：parentId === null 为大类；parentId = 大类id 为子类
const DEFAULT_CATEGORIES = [
  { id: FAV_CAT_ID, name: "收藏", icon: "⭐", fixed: true },
  { id: UNCAT_ID, name: "未分类", icon: "🧩", fixed: true, parentId: null },
  // 大类
  { id: 1, name: "主体", icon: "🧍", parentId: null },
  { id: 2, name: "场景", icon: "🏞️", parentId: null },
  { id: 3, name: "镜头", icon: "📷", parentId: null },
  { id: 4, name: "风格", icon: "🎨", parentId: null },
  { id: 5, name: "光影", icon: "💡", parentId: null },
  { id: 6, name: "细节", icon: "✨", parentId: null },
  { id: 7, name: "画质", icon: "🏷️", parentId: null },
  // 主体
  { id: 101, name: "人物", icon: "👤", parentId: 1 },
  { id: 102, name: "动物", icon: "🐾", parentId: 1 },
  { id: 103, name: "物体", icon: "📦", parentId: 1 },
  { id: 104, name: "场景主体", icon: "🏞️", parentId: 1 },
  // 场景
  { id: 111, name: "大场景", icon: "🗺️", parentId: 2 },
  { id: 112, name: "时间天气", icon: "🌦️", parentId: 2 },
  { id: 113, name: "背景层次", icon: "🖼️", parentId: 2 },
  // 镜头
  { id: 121, name: "景别", icon: "🔍", parentId: 3 },
  { id: 122, name: "视角", icon: "📷", parentId: 3 },
  { id: 123, name: "构图法则", icon: "🖼️", parentId: 3 },
  { id: 124, name: "画幅", icon: "🏷️", parentId: 3 },
  // 风格
  { id: 131, name: "摄影写实", icon: "📷", parentId: 4 },
  { id: 132, name: "传统绘画", icon: "🎨", parentId: 4 },
  { id: 133, name: "动漫二次元", icon: "🤖", parentId: 4 },
  { id: 134, name: "3D渲染", icon: "🖼️", parentId: 4 },
  { id: 135, name: "主题氛围", icon: "✨", parentId: 4 },
  { id: 136, name: "风格修饰语", icon: "🏷️", parentId: 4 },
  // 光影
  { id: 141, name: "光源方向", icon: "💡", parentId: 5 },
  { id: 142, name: "大气特效", icon: "🌈", parentId: 5 },
  { id: 143, name: "色调情绪", icon: "🎨", parentId: 5 },
  // 细节
  { id: 151, name: "主体材质", icon: "✨", parentId: 6 },
  { id: 152, name: "动态微粒", icon: "✨", parentId: 6 },
  { id: 153, name: "干净度约束", icon: "🧩", parentId: 6 },
];
const DEFAULT_TAGS = [
  { id: 1, categoryId: 135, cn: "赛博朋克" }, { id: 2, categoryId: 132, cn: "油画" },
  { id: 3, categoryId: 132, cn: "水彩" }, { id: 4, categoryId: 133, cn: "像素风" },
  { id: 5, categoryId: 133, cn: "宫崎骏风" }, { id: 6, categoryId: 141, cn: "霓虹灯光" },
  { id: 7, categoryId: 142, cn: "体积光" }, { id: 8, categoryId: 142, cn: "丁达尔效应" },
  { id: 9, categoryId: 7, cn: "8K超高清" }, { id: 10, categoryId: 7, cn: "超精细" },
  { id: 11, categoryId: 7, cn: "虚幻引擎" }, { id: 12, categoryId: 7, cn: "电影级" },
];
