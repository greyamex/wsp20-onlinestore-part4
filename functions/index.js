const functions = require('firebase-functions');
const express = require('express')
const app = express()
const path = require('path')

exports.httpReq = functions.https.onRequest(app)

// middleware

app.use(express.urlencoded({extended: false}))
// public is logical name, takes to functions folder, then need to go to static to complete path
app.use('/public', express.static(path.join(__dirname, '/static')))

// set template engine

// both parameters are predefined constants:
app.set('view engine', 'ejs')
// location of ejs files:
app.set('views', './ejsviews')

// frontend programming

function frontendHandler(req, res) {
    res.sendFile(path.join(__dirname, '/prodadmin/prodadmin.html')) // send a file to the client
}

app.get('/login', frontendHandler);
app.get('/home', frontendHandler);
app.get('/add', frontendHandler);
app.get('/show', frontendHandler);

// backend programming

// session variable we will store session information into
const session = require('express-session')
app.use(session(
    {
        secret: 'anysecretstring.dlkfsilnlin!!!',
        name: '__session',
        saveUninitialized: false,
        resave: false,
        secure: true, // https - S, cookie is a text file so if anyone taps in, 
        // 1000 ms * 60 = 1 second
        maxAge: 1000*60*60*2, // 2 hours, this is like allowed idle time we allot the user
        rolling: true, // reset maxAge at every response (resets if client keeps connecting)
    }
))

const firebase = require('firebase')

// Your web app's Firebase configuration -- this is node.js backend web API, not administrator's API
const firebaseConfig = {
    apiKey: "AIzaSyD9lccgaGUFunyHA_wdJhWoaDcPNMN7ENQ",
    authDomain: "williamb-wsp20.firebaseapp.com",
    databaseURL: "https://williamb-wsp20.firebaseio.com",
    projectId: "williamb-wsp20",
    storageBucket: "williamb-wsp20.appspot.com",
    messagingSenderId: "211542408687",
    appId: "1:211542408687:web:3fd56b2129c39e16410a1a"
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

const adminUtil = require('./adminUtil.js')
const Constants = require('./myconstants.js')

app.get('/', auth, async (req, res) => {  // Arrow: fn def is given directly -- request and response object
    // console.log('===============', req.decodedIdToken ? req.decodedIdToken.email : 'no user')
    const cartCount = req.session.cart ? req.session.cart.length : 0
    const coll = firebase.firestore().collection(Constants.COLL_PRODUCTS)
    try {
        let products = []
        const snapshot = await coll.orderBy("name").get()
        snapshot.forEach(doc => {
            products.push({id: doc.id, data: doc.data()})
        })
        res.setHeader('Cache-Control', 'private');
        // can pass one object with render
        res.render('storefront.ejs', {error: false, products, user: req.decodedIdToken, cartCount})
    } catch (e) {
        res.setHeader('Cache-Control', 'private');
        res.render('storefront.ejs', {error: e, user: req.decodedIdToken, cartCount}) // error: true
    }
})

// auth is a function being called first
app.get('/b/about', auth, (req, res) => {
    cartCount = req.session.cart ? req.session.cart.length : 0
    res.setHeader('Cache-Control', 'private');
    res.render('about.ejs', {user: req.decodedIdToken, cartCount})
})

app.get('/b/contact', auth, (req, res) => {
    cartCount = req.session.cart ? req.session.cart.length : 0
    res.setHeader('Cache-Control', 'private');
    res.render('contact.ejs', {user: req.decodedIdToken}, cartCount)
})

app.get('/b/signin', (req, res) => {
    res.setHeader('Cache-Control', 'private');
    res.render('signin.ejs', {error: false, user: req.decodedIdToken, cartCount: 0})
})

app.post('/b/signin', async (req, res) => {
    const email = req.body.email
    const password = req.body.password
    const auth = firebase.auth()
    try {
        // receive encoded token of the user
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
        const userRecord = await auth.signInWithEmailAndPassword(email, password)
        const idToken = await userRecord.user.getIdToken()
        await auth.signOut()

        // store in session variable
        req.session.idToken = idToken

        if (userRecord.user.email === Constants.SYSADMINEMAIL) {
            res.setHeader('Cache-Control', 'private');
            res.redirect('/admin/sysadmin')
        } else {
            if (!req.session.cart) {
                res.setHeader('Cache-Control', 'private');
                res.redirect('/')
            } else {
                res.setHeader('Cache-Control', 'private');
                res.redirect('/b/shoppingcart')
            }
        }
    } catch (e) {
        res.setHeader('Cache-Control', 'private');
        res.render('signin', {error: e, user: null, cartCount: 0})
    }
})

app.get('/b/signout', async (req, res) => {

    req.session.destroy(err => {
        if (err) {
            console.log('====== session.destroy error: ', err)
            req.session = null
            res.send('Error: sign out (session.destroy error)')
        } else {
            res.redirect('/')
        }
    })
})

app.get('/b/profile', authAndRedirectSignIn, (req, res) => {
        const cartCount = req.session.cart ? req.session.cart.length : 0
        console.log('========== decodedIdToken', req.decodedIdToken)
        res.setHeader('Cache-Control', 'private');
        res.render('profile', {user: req.decodedIdToken, cartCount, orders: false})
})

app.get('/b/signup', (req, res) => {
    res.render('signup.ejs', {page: 'signup', user: null, error: false})
})

const ShoppingCart = require('./model/ShoppingCart.js')

app.post('/b/add2cart', async (req, res) => {
    const id = req.body.docId
    const collection = firebase.firestore().collection(Constants.COLL_PRODUCTS)
    try {
        // get product data from firebase
        const doc = await collection.doc(id).get()
        // store into shopping cart
        let cart;
        if (!req.session.cart) {
            // first time add to cart
            cart = new ShoppingCart()
        } else {
            cart = ShoppingCart.deserialize(req.session.cart)
        }
        // store product data from firebase into shopping cart
        const {name, price, summary, image, image_url} = doc.data()
        cart.add({id, name, price, summary, image, image_url})
        req.session.cart = cart.serialize()
        res.setHeader('Cache-Control', 'private');
        res.redirect('/b/shoppingcart')
    } catch (e) {
        res.setHeader('Cache-Control', 'private');
        res.send(JSON.stringify(e))
    }
})

app.get('/b/shoppingcart', authAndRedirectSignIn, (req, res) => {
    let cart
    if (!req.session.cart) {
        cart = new ShoppingCart()
    } else {
        cart = ShoppingCart.deserialize(req.session.cart)
    }
    res.setHeader('Cache-Control', 'private');
    //res.send(JSON.stringify(cart.contents))
    res.render('shoppingcart.ejs', {message: false, cart, user: req.decodedIdToken, cartCount: cart.contents.length})
})

app.post('/b/checkout', authAndRedirectSignIn, async (req, res) => {
    if (!req.session.cart) {
        res.setHeader('Cache-Control', 'private');
        return res.send('Shopping Cart is Empty!')
    }

    // data format to store in firestore
    // collection: orders
    // {uid, timestamp, cart}
    // cart = [{product, qty} ....] // contents in shoppingcart

    const data = {
        uid: req.decodedIdToken.uid,
        // timestamp: firebase.firestore.Timestamp.fromDate(new Date()),
        cart: req.session.cart
    }

    try {
        await adminUtil.checkOut(data)
        req.session.cart = null;
        res.setHeader('Cache-Control', 'private');
        return res.render('shoppingcart.ejs', 
            {message: 'Checked Out Successfully!', cart: new ShoppingCart(), user: req.decodedIdToken, cartCount: 0})
    } catch (e) {
        const cart = ShoppingCart.deserialize(req.session.cart)
        res.setHeader('Cache-Control', 'private');
        return res.render('shoppingcart.ejs',
        {message: 'Check Out Failed. Try Again Later!', cart, user: req.decodedIdToken, cartCount: cart.contents.length}
        )
    }
})

app.get('/b/orderhistory', authAndRedirectSignIn, async (req, res) => {
    try {
        const orders = await adminUtil.getOrderHistory(req.decodedIdToken)
        res.setHeader('Cache-Control', 'private');
        res.render('profile.ejs', {user: req.decodedIdToken, cartCount: 0, orders})
    } catch (e) {
        console.log('==========', e)
        res.setHeader('Cache-Control', 'private');
        res.send('<h1>Order History Error</h1>')
    }
})

// middleware

async function authAndRedirectSignIn(req, res, next) {
    try {
        const decodedIdToken = await adminUtil.verifyIdToken(req.session.idToken)
        if (decodedIdToken.uid) {
            req.decodedIdToken = decodedIdToken
            return next()
        }
    } catch (e) {
        console.log('====== authAndRedirect error', e)
    }

    res.setHeader('Cache-Control', 'private');
    return res.redirect('/b/signin')
}

// next means that (req, res) will be called after auth is called in app.get fns
async function auth(req, res, next) {

    try {
        if (req.session && req.session.idToken) {
            // verify token
            const decodedIdToken = await adminUtil.verifyIdToken(req.session.idToken)
            // when returned
            req.decodedIdToken = decodedIdToken
        } else {
            req.decodedIdToken = null
        }
    } catch (e) {
        req.decodedIdToken = null
    }

    next()
}

// admin api

app.post('/admin/signup', (req, res) => {
    return adminUtil.createUser(req, res)
})

app.get('/admin/sysadmin', authSysAdmin, (req, res) => {
    res.render('admin/sysadmin.ejs')
})

app.get('/admin/listUsers', authSysAdmin, (req, res) => {
    return adminUtil.listUsers(req, res)
})

async function authSysAdmin(req, res, next) {
    try {
        const decodedIdToken = await adminUtil.verifyIdToken(req.session.idToken)
        if (!decodedIdToken || !decodedIdToken.email || decodedIdToken.email !== Constants.SYSADMINEMAIL) {
            return res.send('<h1>System Admin Page: Access Denied!</h1>')
        }
        if (decodedIdToken.uid) {
            req.decodedIdToken = decodedIdToken
            return next()
        }
        return res.send('<h1>System Admin Page: Access Denied!</h1>')
    } catch (e) {
        return res.send('<h1>System Admin Page: Access Denied!</h1>')
    }
}

// test code

app.get('/testlogin', (req, res) => {
    res.sendFile(path.join(__dirname, '/static/html/login.html'))
 })

 // req.body for post
app.post('/testsignIn', (req, res) => {
    const email = req.body.email
    const password = req.body.pass
    // let page = `
    //     (POST) You entered: ${email} and ${password}
    // `;
    // res.send(page)
    const obj = {
        a: email,
        b: password,
        c: '<h1>login success</h1>',
        d: '<h1>login success</h1>',
        start: 1,
        end: 10
    }
    res.render('home', obj) // render ejs file
})

// req.query only for get
app.get('/testsignIn', (req, res) => {
    const email = req.query.email
    const password = req.query.pass
    let page = `
        You entered: ${email} and ${password}
    `;
    res.send(page)
})

app.get('/test', (req, res) => {
    const time = new Date().toString() // server's time is read
    let page = `
        <h1>Current Time At Server: ${time}</h1>
    `;
    res.header('refresh', 1)
    res.send(page)
})

app.get('/test2', (req, res) => {
    res.redirect('http://www.uco.edu')
})