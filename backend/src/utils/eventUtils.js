// Utility for event streaming

function pushSseEvent(response, event, data) {
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}

module.exports = {
  pushSseEvent
}
