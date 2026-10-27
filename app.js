// app.js —— 小程序入口文件
const config = require('./config.js')

App({
  onLaunch() {
    // 只有填了环境 ID 才初始化云开发
    if (wx.cloud && config.ENV_ID) {
      wx.cloud.init({
        env: config.ENV_ID,
        traceUser: true
      })
      this.cloudReady = true
      console.log('云开发已就绪：' + config.ENV_ID)
    } else {
      this.cloudReady = false
      console.warn('还没填云开发环境 ID，留言板暂时用不了。改 config.js 就行。')
    }
  }
})
