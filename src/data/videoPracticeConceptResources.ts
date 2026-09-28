import type { PracticeConcept } from '../lib/videoPractice';
import { knowledgeAreaPath } from '../lib/routes';

// Public source pages and image addresses checked 2026-09-25.
// These are literacy examples, distinct from the exercise's source-film references.
type Resources = Pick<PracticeConcept, 'readings' | 'illustration'>;
const yaleScene = 'https://filmanalysis.yale.edu/mise-en-scene/';
const yaleCamera = 'https://filmanalysis.yale.edu/cinematography/';
const yaleEdit = 'https://filmanalysis.yale.edu/editing/';
const narrative = 'https://open.library.okstate.edu/introfilmtv/part/narrative/';
const realism = 'https://www.bfi.org.uk/features/where-begin-with-roberto-rossellini';
const advertising = 'https://www.apple.com/newsroom/2022/09/apple-announces-the-next-generation-of-airpods-pro/';
const dream = 'https://www.bfi.org.uk/features/red-shoes-michael-powell-emeric-pressburger';
const documentary = 'https://mayslesfilms.com/film/salesman/';
const animation = 'https://www.pixar.com/soul';
const external = (title: string, url: string, publisher: string, locate: string): PracticeConcept['readings'][number] => ({ title, url, publisher, locate, language: '英文' });
const local = (title: string, area: 'script' | 'image-asset' | 'shot-prompt', path: string, locate: string): PracticeConcept['readings'][number] => ({ title, url: knowledgeAreaPath(area, path), publisher: '项目导演知识库', locate, language: '中文' });
const director = (title: string, locate: string) => local(title, 'shot-prompt', '导演设计方法.md', locate);
const acting = (title: string, locate: string) => local(title, 'shot-prompt', '对白、梗与情绪的分镜写法.md', locate);
const narrativeReading = (locate: string) => external('叙事范围：观众与人物知道多少', narrative, '俄克拉荷马州立大学开放教材', locate);

export const conceptResources: Record<string, Resources> = {
  '生活写实': {
    readings: [external('从罗西里尼理解新现实主义', realism, '英国电影协会 BFI', '看 Rome, Open City 段：普通人的处境、地点与生活细节；它是一个历史案例，并不等于所有写实风格。'), local('环境与物件怎样支持人物生活', 'image-asset', '场景道具与状态图.md', '对照自己的房间，检查布局、物品用途与使用状态。')],
    illustration: { src: 'https://core-cms.bfi.org.uk/sites/default/files/styles/responsive/public/2025-09/rome-open-city-1945-pina-looks-reproachfully.jpeg/600x0/rome-open-city-1945-pina-looks-reproachfully.jpeg', alt: '《罗马，不设防的城市》的黑白人物与环境剧照', work: '《罗马，不设防的城市》· 1945', credit: '剧照由 BFI 文章展示', sourceUrl: realism, lookFor: '先看人物衣着与周围环境是否构成同一个生活处境；黑白本身不是写实的判据。' },
  },
  '商业广告取向': {
    readings: [external('观察官方产品视觉怎样突出商品', advertising, 'Apple Newsroom', '看开头产品主图：背景、轮廓、高光和摆放共同突出产品。此链接是视觉案例，不是风格分类教材。')],
    illustration: { src: 'https://www.apple.com/newsroom/images/product/airpods/standard/Apple-AirPods-Pro-2nd-gen-hero-220907_big.jpg.large.jpg', alt: 'AirPods Pro 第二代官方产品视觉', work: 'AirPods Pro · 官方产品视觉', credit: 'Apple，2022', sourceUrl: advertising, lookFor: '看产品轮廓、表面高光与留白，注意目光如何快速集中到商品；这只是广告的一种呈现取向。' },
  },
  '黑色电影取向': {
    readings: [external('低调照明与《历劫佳人》图例', yaleScene, '耶鲁大学 Film Analysis', '定位 Section 2 — Lighting → LOW-KEY LIGHTING，连看亮区、暗区与人物遮蔽。')],
    illustration: { src: 'https://filmanalysis.yale.edu/wp-content/uploads/2012/03/toelowk2.jpg', alt: '《历劫佳人》的低调照明剧照', work: '《历劫佳人》· 1958', credit: '教学帧图：耶鲁大学 Film Analysis', sourceUrl: yaleScene, lookFor: '看哪些脸部和空间信息被光照亮、哪些留在暗处；作用来自信息取舍，不是统一把曝光调低。' },
  },
  '梦幻与表现取向': {
    readings: [external('《迷魂记》的梦境合成图例', yaleScene, '耶鲁大学 Film Analysis', '定位 Matte Shot，比较正常空间与人物梦境的合成画面。'), external('《红菱艳》如何用色彩与舞台表达情绪', dream, '英国电影协会 BFI', '看 Technicolor、舞蹈与设计的讨论；它示范表现性的一个分支，不涵盖所有梦幻风格。')],
    illustration: { src: 'https://filmanalysis.yale.edu/wp-content/uploads/2012/03/vert1.jpg', alt: '《迷魂记》的彩色梦境合成画面', work: '《迷魂记》· 1958', credit: '教学帧图：耶鲁大学 Film Analysis', sourceUrl: yaleScene, lookFor: '看人物与非日常图形、色彩怎样合成主观感受；它让你进入心理经验，而不是把梦境当普通房间来展示。' },
  },
  '纪录观察姿态': {
    readings: [external('《推销员》：直接电影的具体作品', documentary, 'Maysles Films · 制作方', '看作品介绍并寻找影片片段；静帧只展示取景，观察时间与不干预姿态必须连看视频。'), external('发行方对观察式叙事的介绍', 'https://www.criterion.com/films/663-salesman', 'Criterion Collection', '看影片简介中的 observational style，了解它关注怎样的普通生活。')],
    illustration: { src: 'https://mayslesfilms.com/wp-content/uploads/2014/02/13-salesman.jpg', alt: '纪录片《推销员》的黑白剧照', work: '《推销员》· 1969', credit: 'Maysles Films · 官方作品页', sourceUrl: documentary, lookFor: '看镜头如何把人物放回正在发生的生活处境；再点作品页连看片段，判断行动前后的时间如何保留。' },
  },
  '动画与图形化语言': {
    readings: [external('《心灵奇旅》的角色与世界设计', animation, 'Pixar · 制作方', '对比现实纽约与灵魂世界，观察人物轮廓、材质与空间规则。'), external('动画摄影如何处理光线与肤色', 'https://renderman.pixar.com/stories/cinematography-with-soul', 'Pixar RenderMan', '看 Skin Lighting 的图例，理解动画同样需要摄影与受光逻辑。')],
    illustration: { src: 'https://images.squarespace-cdn.com/content/v1/60241cb68df65b530cd84d95/bd450e56-748b-4633-9877-578807ef4d0b/s648_6a_cs.sel16.365.jpg', alt: '《心灵奇旅》的动画角色视觉', work: '《心灵奇旅》· 2020', credit: '© Disney/Pixar · Pixar 官方作品页', sourceUrl: animation, lookFor: '看设计过的轮廓、比例与材质；动画是呈现方式，也能同时采用写实光照或梦幻色彩。' },
  },
  '方向': { readings: [external('光从哪边来：照明图与人物示例', yaleScene, '耶鲁大学 Film Analysis', '定位 Section 2 — Lighting → THREE-POINT LIGHTING，看主光、补光、轮廓光的位置。'), director('把光源方向写进 AI 场景', '读“七、光影和环境必须参与因果”。')] },
  '软硬': { readings: [external('硬光与软光的阴影差异', 'https://www.arri.com/en/learn-help/lighting/lighting-handbook', 'ARRI 官方照明手册', '从页面打开手册，读 Hard Light / Soft Light 的对照图；重点看阴影边缘，不必购买或操作灯具。')] },
  '明暗关系': { readings: [external('高调与低调照明对照', yaleScene, '耶鲁大学 Film Analysis', '比较 HIGH-KEY LIGHTING 与 LOW-KEY LIGHTING 两组图片。')] },
  '冷暖关系': { readings: [external('颜色、光照与表面怎样相互作用', 'https://renderman.pixar.com/stories/cinematography-with-soul', 'Pixar RenderMan', '读 Skin Lighting 并看彩色光照图；不能把某种颜色固定翻译为一种情绪。'), director('让受光随空间相容', '读“七、光影和环境必须参与因果”，回到本片厨房与餐厅对照。')] },
  '说话目的': { readings: [acting('用目标、阻力与策略组织表演', '读“重点场的最小事实包”和“用对白调音卡代替固定百分比”。')] },
  '倾听与回应': { readings: [acting('让下一句话接住上一刻', '读“每句话都要接住上一刻”和“镜头怎样配合说与听”。')] },
  '微动作与可读景别': { readings: [acting('何时写动作与微表情', '读“动作神态只在改变理解时写”；再检查选定景别能否看清。'), director('不同景别能读到多少信息', '读“三、按信息量选景别”。')] },
  '情绪余波': { readings: [acting('情绪峰值后怎样留下状态', '读“情绪峰值之后要留下可继承状态”，看触发、身体反应与残留的例子。')] },
  '观众先知道': { readings: [narrativeReading('定位 NARRATION → Degree of omniscience，比较 unrestricted 与 restricted narration；追踪观众比人物多知道的事实。')] },
  '观众与人物同知': { readings: [narrativeReading('定位 NARRATION → Degree of omniscience，阅读 restricted narration，观察信息如何随人物行动被发现。')] },
  '人物先知道': { readings: [narrativeReading('定位 NARRATION → Degree of omniscience，关注观众少于人物的信息，以及因此形成的好奇。')] },
  '景别与视点': { readings: [external('景别、构图与主观镜头图例', yaleCamera, '耶鲁大学 Film Analysis', '定位 FRAMING 与 POINT-OF-VIEW SHOT，比较不同距离和观看位置。'), director('用景别与角度安排观众位置', '读“三、按信息量选景别”和“四、角度决定观众站在哪里”。')] },
  '连续呈现': { readings: [external('连续性剪辑怎样让动作可追踪', yaleEdit, '耶鲁大学 Film Analysis', '定位 CONTINUITY EDITING 与 MATCH ON ACTION；连续动作可以由多个镜头组成。')] },
  '时间省略': { readings: [external('省略剪辑的定义与片段', yaleEdit, '耶鲁大学 Film Analysis', '定位 ELLIPTICAL EDITING，对照完整事件与银幕上留下的部分。')] },
  '预期与结果': { readings: [local('喜剧怎样建立预期并留下后果', 'script', '对白、梗与情绪节拍.md', '读“什么时候加梗”，对照正常预期、合理偏离、反应与后果。')] },
  '反应与节奏': { readings: [external('同样的对话，节奏为什么不同', yaleEdit, '耶鲁大学 Film Analysis', '定位 RHYTHM，比较页面两段餐桌交流；不要只数镜头长度。'), acting('给听者反应留出作用', '读“梗怎样进入分镜”和“先给戏时间，再定镜长”。')] },
  '线索铺垫': { readings: [local('让规则与信息推动下一步行动', 'script', '从想法到故事.md', '读“完善顺序”中的规则、信息阶梯与分集尾钩。'), narrativeReading('读因果链与情节信息的安排，检查前面的事实是否支持后续事件。')] },
  '日常与异常的反差': { readings: [external('画外空间怎样引出未见的存在', yaleScene, '耶鲁大学 Film Analysis', '定位 Offscreen Space，看画框外的信息如何进入观众注意。'), director('让环境变化有可见原因', '读“七、光影和环境必须参与因果”；异常要由叙事明确建立。')] },
  '观众比人物先知': { readings: [narrativeReading('定位 NARRATION → Degree of omniscience，回看片尾时分别记录人物与观众知道什么。')] },
  '悬念与惊吓': { readings: [narrativeReading('读信息范围及其 suspense / surprise 讨论，区分持续期待与突然获知。'), local('把危险变成明确的故事期待', 'script', '从想法到故事.md', '读“设计分集尾钩”和“常见失败”，检查最后留下的具体问题。')] },
};
