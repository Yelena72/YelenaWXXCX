/* ============================================================
   data/content.js —— 出厂默认内容（已经不是唯一的入口了）

   这个文件里放的是「第一次打开小程序时」灌进去的初始内容。
   打开过一次之后，内容就存在手机本地缓存里了，之后请直接在小程序里改：

     昵称 / 签名 / 标签 / 城市 / 身份 / MBTI / 状态 / 自我介绍 / 属性条
       → 「关于我」页 → 修改我的资料
     个人经历 / 兴趣爱好 / 想学的技能 / 未来展望
       → 各自页面里点卡片，或点「添加」
     性格标签 / 交友偏好 / 想认识这样的你 / 微信号
       → 「人际交往」页 → 修改这页的文案

   ⚠️ 改这个文件，只有在「从没打开过」或「清过缓存」之后重新进入才会生效，
      已经打开过的小程序不会变。
      想彻底恢复到这里的默认值：微信里删掉小程序，重新搜索进入。
   ============================================================ */

module.exports = {
  /* ---------------- 基本信息 ---------------- */
  profile: {
    name: 'Yelena',
    // 头像固定用 images/avatar.png，改这个文件换不了头像
    signature: '正在努力成为更好的自己',
    city: '深圳',
    identity: 'SZUer',
    mbti: 'ENTJ',
    status: '稳稳的很安心',
    intro: '喜欢可爱的东西，也喜欢把脑子里的想法变成能点开的东西。',
    tags: ['慢热', '细心', '爱幻想'] // 角色卡下面那排小标签
  },

  /* ---------------- 属性面板（关于我页面） ---------------- */
  /* value 是 0-100 的数字，控制进度条长度 */
  stats: [
    { name: '外向', value: 40, color: '#4FC3F7' },
    { name: '好奇心', value: 85, color: '#FFC845' },
    { name: '行动力', value: 60, color: '#6FD070' },
    { name: '专注力', value: 70, color: '#FF8FC7' }
  ],

  /* ---------------- 个人经历（时间轴） ---------------- */
  /* 下面是初始的三条，之后在「个人经历」页里自己加 / 改 */
  experiences: [
    {
      year: '2024',
      title: '第一次接触编程',
      desc: '从 HTML 开始，做出了人生第一个网页。'
    },
    {
      year: '2025',
      title: '开始学前端',
      desc: '慢慢能看懂别人的代码，也开始自己写小练习。'
    },
    {
      year: '2026',
      title: '做出小程序',
      desc: '把想法变成真的能打开的东西，感觉很好。'
    }
  ],

  /* ---------------- 兴趣爱好（卡片） ---------------- */
  /* icon 可选 7 种：
     ico-music 音乐 / ico-book 书 / ico-game 游戏 / ico-cake 蛋糕
     ico-camera 摄影 / ico-pin 地点 / ico-movie 电影 */
  hobbies: [
    { icon: 'ico-music', name: '听歌', desc: '通勤路上必戴耳机' },
    { icon: 'ico-book', name: '看小说', desc: '偏爱奇幻和推理' },
    { icon: 'ico-game', name: '打游戏', desc: '喜欢像素风和解谜' },
    { icon: 'ico-cake', name: '做甜点', desc: '翻车率高但很快乐' }
  ],

  /* ---------------- 想学的技能（进度条） ---------------- */
  /* percent 是百分比，0 到 100 */
  skills: [
    { name: '微信小程序', percent: 40, color: '#4ECDC4', note: '正在做这个小程序' },
    { name: 'JavaScript', percent: 35, color: '#FFD93D', note: '能写简单交互' },
    { name: 'UI 设计', percent: 20, color: '#FF6B9D', note: '还在看教程' },
    { name: '英语口语', percent: 15, color: '#A29BFE', note: '每天背 10 个单词' }
  ],

  /* ---------------- 人际交往 ---------------- */
  social: {
    tags: ['慢热', '靠谱', '有点社恐', '喜欢认真聊天'],
    prefer: '比起热闹的聚会，更喜欢一对一聊很久。',
    want: '想认识愿意分享、不着急下判断的人。',
    contact: 'ZY3264219729' // 微信号
  },

  /* ---------------- 未来展望 ---------------- */
  /* group 分三组：ultimate 终极目标 / short 短期目标 / place 想去的地方
     scene 配图，可选：sea 海边 / mountain 山顶 / city 城市 / forest 森林 / sky 热气球 */
  future: [
    {
      group: 'ultimate',
      text: '独立做出一个有人用的小产品',
      note: '哪怕只有一百个人在用，也算数',
      scene: 'city'
    },
    {
      group: 'ultimate',
      text: '有一间自己的工作室',
      note: '一扇窗，一张桌子，够安静就好',
      scene: 'sky'
    },

    {
      group: 'short',
      text: '学会前端框架，能自己写完整网站',
      when: '两年内',
      scene: 'mountain'
    },
    {
      group: 'short',
      text: '把这个小程序完整做上线',
      when: '今年',
      scene: 'city'
    },

    {
      group: 'place',
      text: '去一次海边，住够一周',
      when: '某个假期',
      scene: 'sea'
    },
    {
      group: 'place',
      text: '爬到山顶看一次日出',
      when: '明年',
      scene: 'mountain'
    }
  ]
}
