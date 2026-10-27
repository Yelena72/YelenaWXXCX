// 云函数：deleteMessage —— 删除一条留言
// 只能在「这条留言的 openid == 当前用户 openid」时才允许删。
// 这个判断必须放在云端做，前端隐藏按钮不算数。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const myOpenid = wxContext.OPENID
  const id = String(event.id || '')

  if (!id) {
    return { ok: false, msg: '缺少留言 id' }
  }

  let doc = null

  try {
    const res = await db.collection('messages').doc(id).get()
    doc = res.data
  } catch (e) {
    return { ok: false, msg: '这条留言已经不在了' }
  }

  if (!doc) {
    return { ok: false, msg: '这条留言已经不在了' }
  }

  if (doc.openid !== myOpenid) {
    return { ok: false, msg: '只能删自己写的留言' }
  }

  try {
    await db.collection('messages').doc(id).remove()
    return { ok: true }
  } catch (e) {
    return { ok: false, msg: '删除失败，稍后再试', err: String(e) }
  }
}
