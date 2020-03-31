function home_page() {
    // this is how we protect the page: only called if successfully authenticated
    // auth.js: email, success (secured function is called), fail_url
    auth('prodadmin@test.com', home_page_secured, '/login')
}

function home_page_secured() {
    glPageContent.innerHTML = '<h1>Home Page</h1>'
    glPageContent.innerHTML += `
        <a href='/add' class="btn btn-outline-primary">Add A Product</a>
        <a href='/show' class="btn btn-outline-primary">Show Products</a>
        <button class="btn btn-outline-danger" type="button" onclick="logOut()">Log Out</button>
    `;
}

async function logOut() {
    try {
        await firebase.auth().signOut()
        window.location.href= '/login'
    } catch (e) {
        window.location.href= '/login'
    }
}