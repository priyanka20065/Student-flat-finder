// Utility for profile scoring

function profileToScore(target, preferences) {
  const cleanlinessScore = 10 - Math.abs(target.cleanliness - preferences.cleanliness)
  const socialScore = 10 - Math.abs(target.socialLevel - preferences.socialLevel)
  const studyScore = 10 - Math.abs(target.studyHabits - preferences.studyHabits)
  return cleanlinessScore + socialScore + studyScore
}

module.exports = {
  profileToScore
}
