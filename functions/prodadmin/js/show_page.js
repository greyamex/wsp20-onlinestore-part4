function show_page() {
    auth('prodadmin@test.com', show_page_secured, '/login')
}

// storing products in an array, functions can access
let products; // global variable on this page, a list of products read from db

async function show_page_secured() {
    glPageContent.innerHTML = '<h1>Show Products</h1>'
    glPageContent.innerHTML += `
        <a href='/home' class="btn btn-outline-primary">Home</a>
        <a href='/add' class="btn btn-outline-primary">Add a Product</a>
        <br>
    `;

    // nonblocking synchronous function call, so set up try/catch block
    try {
        // array will store all product info
        products = []
        // snapshot (of this collection in the database)
        const snapshot = await firebase.firestore().collection(COLLECTION)
                        // add where clause for query:
                        // (look at index types documentation - boookmarked in WSP)
                        // (see: composite index, further down that page)
                        //.where("name", "==", "YYYYYY")
                        //.orderBy("price")
                        .get()

        // read all the products from the collection
        snapshot.forEach( doc => {
            // read each key-value in document and then store it into a var
            const {name, summary, price, image, image_url} = doc.data()
            // construct a javascript object:
            // like primary key in SQL, each NoSQL document has a document id
            // here, variable docId is storing the doc.id
            const p = {docId: doc.id, name, summary, price, image, image_url}
            // push into products array:
            products.push(p)
        })
    } catch (e) {
        glaPageContent.innerHTML = 'Firestore access error. Try again later!<br>' + e
        // return think of as 'stop here'
        return
    }

    if (products.length === 0) {
        // using += will allow to keep the navigation menu on the top
        glPageContent.innerHTML += '<h1>No products in the database</h1>'
        return
    }

    for (let index = 0; index < products.length; index++) {
        // define p (this caused error): 'products at index'
        const p = products[index]
        // skip any deleted elements
        if (!p) continue
        // use .innerHTML for <complex> HTML, along with back quote
        // add id attribute to card div: unique id is doc id provided by firestore
        // add display: inline-block so the images will not display as a column
        // manually added button: 2 functions here
        glPageContent.innerHTML += `
        <div id="${p.docId}" class="card" style="width: 18rem; display: inline-block">
            <img src="${p.image_url}" class="card-img-top">
            <div class="card-body">
            <h5 class="card-title">${p.name}</h5>
            <p class="card-text">${p.price}<br/>${p.summary}</p>
            <button class="btn btn-primary" type="button"
                onclick="editProduct(${index})">Edit</button>
            <button class="btn btn-danger" type="button"
                onclick="deleteProduct(${index})">Delete</button>
            </div>
        </div>
        `;
    }
}

// make global in this file so can be used outside of function:
let cardOriginal
let imageFile2Update

// edit:

function editProduct(index) {
    const p = products[index]
    const card = document.getElementById(p.docId)
    // save the original HTML
    cardOriginal = card.innerHTML
    // copied this HTML code from add_page.js, added ${} values, 
    // removed error message in case want to keep same image
    // onclick --> update(), cancel()
    card.innerHTML = `
    <div class="form-group">
        Name: <input class="form-control" type="text" id="name" value="${p.name}"/>
        <p id="name_error" style="color:red;" />
    </div>
    <div class="form-group">
        Summmary: <br>
        <textarea class="form-control" id="summary" cols="40" rows="5">${p.summary}</textarea>
        <p id="summary_error" style="color:red;" />
    </div>
    <div class="form-group">
        Price: <input class="form-control" type="text" id="price" value="${p.price}"/>
        <p id="price_error" style="color:red;" />
    </div>
    Current Image:<br>
    <img src="${p.image_url}"><br>
    <div class="form-group">
        New Image: <input type="file" id="imageButton" value="upload" />
    </div>
    <button class="btn btn-danger" type="button" onclick="update(${index})">Update</button>
    <button class="btn btn-secondary" type="button" onclick="cancel(${index})">Cancel</button>
    `;

    // new image:

    // add event listener 
    // (imageButton from 'New Image: ... id="imageButton")
    const imageButton = document.getElementById('imageButton')
    imageButton.addEventListener('change', e => {
        // get file selected by the button
        imageFile2Update = e.target.files[0]
    })
}

// update:

async function update(index) {
    const p = products[index]
    // name from: id="name"
    const newName = document.getElementById('name').value
    const newSummary = document.getElementById('summary').value
    const newPrice = document.getElementById('price').value

    // validate new values (don't need to include image in validation)
    const nameErrorTag = document.getElementById('name_error')
    const summaryErrorTag = document.getElementById('summary_error')
    const priceErrorTag = document.getElementById('price_error')
    // these functions were already written for 'add'
    nameErrorTag.innerHTML = validate_name(newName)
    summaryErrorTag.innerHTML = validate_summary(newSummary)
    priceErrorTag.innerHTML = validate_price(newPrice)

    // if (... 'is set')
    if (nameErrorTag.innerHTML || summaryErrorTag.innerHTML || priceErrorTag.innerHTML) {
        return
    }

    // ready to update the db

    // flag
    let updated = false
    // begin with empty object
    const newInfo = {}
    // if there is any change
    if (p.name !== newName) {
        newInfo.name = newName
        updated = true
    }
    if (p.summary !== newSummary) {
        newInfo.summary = newSummary
        updated = true
    }
    if (p.price !== newPrice) {
        // have to nest Number here
        newInfo.price = Number(Number(newPrice).toFixed(2))
        updated = true
    }
    // if not set
    if (imageFile2Update) {
        updated = true
    }
    if (!updated) {
        cancel(index)
        return
    }

    // update db:

    try {

        // 1. update the image:

        // if image file is set
        if (imageFile2Update) {
            // upload image first
            const imageRef2del = firebase.storage().ref().child(IMAGE_FOLDER + p.image)
            await imageRef2del.delete()
            //store new image (unique name with the current time)
            const image = Date.now() + imageFile2Update.name
            const newImageRef = firebase.storage().ref(IMAGE_FOLDER + image)
            // store actual image
            const taskSnapshot = await newImageRef.put(imageFile2Update)
            // get url
            const image_url = await taskSnapshot.ref.getDownloadURL()
            // update a new image object
            newInfo.image = image
            newInfo.image_url = image_url
        }

        // 2. update the document in Firestore:

        // only fields that exist will be updated here
        await firebase.firestore().collection(COLLECTION).doc(p.docId).update(newInfo)
        // go to Show:
        window.location.href = '/show'
    } catch (e) {
        glPageContent.innerHTML = 'Firestore/Storage update error<br>' + JSON.stringify(e)
    }
}

// cancel:

function cancel(index) {
    // get the reference to the product:
    const p = products[index]
    // get the reference to the card
    const card = document.getElementById(p.docId)
    // insert copy of original, no change will occur
    card.innerHTML = cardOriginal
}

// delete:

// index is provided
async function deleteProduct(index) {
    try {
        // delete db information
        const p = products[index]
        // delete (1) Firestore doc, (2) Storage image
        await firebase.firestore().collection(COLLECTION).doc(p.docId).delete()
        const imageRef = firebase.storage().ref().child(IMAGE_FOLDER + p.image)
        await imageRef.delete()

        // delete visual in web browser
        // card id ... get the card tag (unique id)
        const card = document.getElementById(p.docId)
        // remove by unique id (card)
        card.parentNode.removeChild(card)

        // add code to for loop: if (!p) continue
        delete products[index]
    } catch (e) {
        glPageContent.innerHTML = 'Delete Error: <br>' + JSON.stringify(e)
    }
}