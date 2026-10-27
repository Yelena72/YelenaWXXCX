// 云函数：replyMessage —— 回复一条留言
// 回复直接存在留言文档的 replies 数组里

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const myOpenid = wxContext.OPENID

  const id = String(event.id || '')
  const nick = String(event.nick || '').trim().slice(0, 12)
  const content = String(event.content || '').trim().slice(0, 120)

  if (!id) {
    return { ok: false, msg: '缺少留言 id' }
  }
  if (!nick) {
    return { ok: false, msg: '先写个昵称吧' }
  }
  if (!content) {
    return { ok: false, msg: '回复不能是空的' }
  }

  // 内容安全检测（和留言一样，只有明确判定有风险才拦）
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

  const reply = {
    id: 'r' + Date.now(),
    openid: myOpenid,
    nick: nick,
    content: content,
    createdAt: Date.now()
  }

  try {
    await db.collection('messages').doc(id).update({
      data: { replies: _.push(reply) }
    })
  } catch (e) {
    return { ok: false, msg: '回复失败，稍后再试', err: String(e) }
  }

  return {
    ok: true,
    reply: {
      id: reply.id,
      nick: reply.nick,
      content: reply.content,
      createdAt: reply.createdAt
    }
  }
}
