
var admin = require("firebase-admin");

var serviceAccount = require("./williamb-wsp20-firebase-adminsdk-9wte0-10c1399231.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://williamb-wsp20.firebaseio.com"
});

async function createUser(req, res) {
  const email = req.body.email
  const password = req.body.password
  const displayName = req.body.displayName
  const phoneNumber = req.body.phoneNumber
  const photoURL = req.body.photoURL

  try {
    await admin.auth().createUser(
      {email, password, displayName, phoneNumber, photoURL}
    )
    // here error is just what gets displayed in red in signup.ejs
    res.render('signin.ejs', {page: 'signin', user: false, error: 'Account created! Sign in please', cartCount: 0})
  } catch (e) {
    res.render('signup.ejs', {error: e, user: false, page: 'signup', cartCount: 0})
  }
}

async function listUsers(req, res) {
  try {
    const userRecord = await admin.auth().listUsers()
    res.render('admin/listUsers.ejs', {users: userRecord.users, error: false})
  } catch (e) {
    res.render('admin/listUsers.ejs', {users: false, error: e})
  }
}

module.exports = {
  createUser,
  listUsers
}