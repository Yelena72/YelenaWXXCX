// 云函数：addMessage —— 发一条留言
// 作用：拿到是谁发的（openid）→ 做内容安全检测 → 写进数据库

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const nick = String(event.nick || '').trim().slice(0, 12)
  const content = String(event.content || '').trim().slice(0, 200)

  if (!nick) {
    return { ok: false, msg: '先写个昵称吧' }
  }
  if (!content) {
    return { ok: false, msg: '留言不能是空的' }
  }

  // 内容安全检测
  // 只有明确判定为「有风险」才拦；接口本身报错（没授权、额度用完等）不拦，只记日志，
  // 否则留言板会因为接口问题整个用不了。
  let blocked = false

  try {
    const check = await cloud.openapi.security.msgSecCheck({
      content: nick + '\n' + content
    })

    if (check && check.result && check.result.suggest && check.result.suggest !== 'pass') {
      blocked = true
    }
  } catch (e) {
    if (e && Number(e.errCode) === 87014) {
      blocked = true
    } else {
      console.warn('msgSecCheck 调用异常，本次放行：', e && e.errMsg, e && e.errCode)
    }
  }

  if (blocked) {
    return { ok: false, msg: '内容好像不太合适，换一句试试' }
  }

  const data = {
    openid: openid,
    nick: nick,
    content: content,
    createdAt: Date.now()
  }

  try {
    await db.collection('messages').add({ data: data })
    return { ok: true }
  } catch (e) {
    // 集合还不存在时，自动建一个再写
    try {
      await db.createCollection('messages')
      await db.collection('messages').add({ data: data })
      return { ok: true }
    } catch (e2) {
      return { ok: false, msg: '保存失败，稍后再试', err: String(e) + ' / ' + String(e2) }
    }
  }
}
