export default eventHandler((event) => {
  return serverAuth().handler(toWebRequest(event))
})
