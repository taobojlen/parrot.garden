export default eventHandler(async (event) => {
  const response = await serverAuth().handler(toWebRequest(event))
  return sendWebResponse(event, response)
})
