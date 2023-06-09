// Required packages
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const ejs = require("ejs");

const axios = require('axios');
const fs = require('fs');

const passport = require("passport");
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");

const { Schema } = mongoose;

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

app.use(session({
  secret: "COMP464",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://127.0.0.1:27017/todolistDB');

// Items schema
const itemsSchema = new mongoose.Schema({
  name: String
});

// User schema
const userSchema = new Schema({
  username: {
    type: String
  },
  password: {
    type: String
  },
  todolist: [itemsSchema]
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  process.nextTick(function () {
    done(null, {
      id: user._id,
      username: user.username
    });
  });
});
passport.deserializeUser(function (user, done) {
  process.nextTick(function () {
    return done(null, user);
  });
});

const Item = mongoose.model("Item", itemsSchema);

// Show the list on the /list page based on which user logged in
app.get("/list", function (req, res) {
  User.findById({
    _id: req.user.id.toString()
  })
    .then(function (foundUsers) {
      res.render("list", {
        newListItems: foundUsers.todolist
      });
    });
});

// Create a new item based on the new written list item and push it to the db
app.post("/list", function (req, res) {
  const itemName = req.body.newItem;
  const item = new Item({
    name: itemName,
  });
  item.save();
  User.findById(req.user.id.toString())
    .then(foundUser => {
      if (foundUser) {
        foundUser.todolist.push(item);
        return foundUser.save();
      }
      return null;
    })
    .then(() => {
      res.redirect("/list");
    })
    .catch(err => {
      console.log(err);
    });
});

// Delete the selected items from db
app.post("/delete", function (req, res) {
  const checkedItemId = req.body.checkbox;
  const selectedItem = Item.findById(checkedItemId);
  User.findOneAndUpdate({
    _id: req.user.id.toString()
  }, {
    $pull: {
      todolist: {
        _id: checkedItemId
      }
    }
  }).then(result => {
    console.log("Deleted from database");
  });
  Item.findByIdAndRemove(checkedItemId).then(result => {
    console.log("Succesfully deleted checked item");
  });
  res.redirect("/list");
});

// Shows contact page
app.get("/contact", function (req, res) {
  res.render("contact");
});

// Shows login page
app.get("/", function (req, res) {
  res.render("login");
});

// Shows list page
app.get("/list", isLoggedIn, function (req, res) {
  res.render("list");
});

// Shows register form
app.get("/register", function (req, res) {
  res.render("register");
});

// User signup
app.post("/register", async (req, res) => {
  const { username, password, repeat_password } = req.body;
  if (password !== repeat_password) {
    // Password and repeat password do not match
    return res.render("register", { error: "Passwords do not match" });
  }
  try { 
    const registerUser = await User.register({ username }, password);
      if (registerUser) {
        passport.authenticate("local")(req, res, function () {
          res.render("login", { success: "Account created successfully. Redirecting to login page..." }, () => {
            setTimeout(() => {
              res.redirect("/");
            }, 1000);
          });
        });
      } else {
        res.redirect("/register");
      }
    } catch (err) {
      res.send(err);
    }
});

// User login
app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, (err) => {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/list");
      });
    }
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

app.listen(3000, function () {
  console.log("Server started on port 3000");
});

/* weather data */

app.get('/weather', (req, res) => {
  const city = req.query.city;

  // Default city ID
  let defaultCityId = '745044'; // Replace with the desired default city ID

  // Check if a city query is provided
  if (city) {
    const cityData = JSON.parse(fs.readFileSync('city.list.json', 'utf8'));

    // Find the selected city by name
    const selectedCity = cityData.find(c => c.name.toLowerCase() === city.toLowerCase());

    // Check if the city exists
    if (selectedCity) {
      defaultCityId = selectedCity.id;
    } else {
      res.send('City not found');
      return;
    }
  }

  // Retrieve weather data for the selected city or default city
  getWeather(defaultCityId)
    .then(weatherData => {
      // Render the weather template with weather data
      res.render('weather', {
        name: weatherData.name,
        temperature: weatherData.main.temp,
        description: weatherData.weather[0].description,
        feelsLike: weatherData.main.feels_like,
        humidity: weatherData.main.humidity,
        windSpeed: weatherData.wind.speed
      });
    })
    .catch(error => {
      console.error('Error:', error);
      // Handle the error
      res.send('Error fetching weather data');
    });
});

// Function to make the API call and retrieve weather data
function getWeather(id) {
  const apiKey = '9396ebe90d9ffa93f8868694387a8afe';
  const url = `https://api.openweathermap.org/data/2.5/weather?APPID=${apiKey}&units=metric&id=${id}`;

  return axios.get(url)
    .then(response => response.data);
}