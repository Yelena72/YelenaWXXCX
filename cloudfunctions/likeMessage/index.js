// 云函数：likeMessage —— 点赞 / 取消点赞
// 用 openid 判断你有没有点过，重复点就是取消

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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

  const likes = doc.likes || []
  const liked = likes.indexOf(myOpenid) >= 0

  try {
    if (liked) {
      await db.collection('messages').doc(id).update({
        data: { likes: _.pull(myOpenid) }
      })
    } else {
      await db.collection('messages').doc(id).update({
        data: { likes: _.addToSet(myOpenid) }
      })
    }
  } catch (e) {
    return { ok: false, msg: '操作失败，稍后再试', err: String(e) }
  }

  return {
    ok: true,
    liked: !liked,
    count: likes.length + (liked ? -1 : 1)
  }
}
