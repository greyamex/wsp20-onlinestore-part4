// email comes in, success function, if fail go to url
function auth(email, success, fail_url) {
  // user is a function here (arrow notation)
  firebase.auth().onAuthStateChanged(user => { 
    // user should be authenticated user
    if (user && user.email === email) {
      success()
    } else {
      window.location.href = fail_url
    }
  })
}