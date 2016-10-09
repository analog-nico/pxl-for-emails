# Pxl for Emails

Open and click tracking for html emails &ndash; hosted by any Express-based node.js app

[![Build Status](https://img.shields.io/travis/analog-nico/pxl-for-emails.svg?style=flat-square)](https://travis-ci.org/analog-nico/pxl-for-emails)
[![Coverage Status](https://img.shields.io/coveralls/analog-nico/pxl-for-emails.svg?style=flat-square)](https://coveralls.io/r/analog-nico/pxl-for-emails)
[![Dependency Status](https://img.shields.io/david/analog-nico/pxl-for-emails.svg?style=flat-square)](https://david-dm.org/analog-nico/pxl-for-emails)
[![Known Vulnerabilities](https://snyk.io/test/npm/pxl-for-emails/badge.svg?style=flat-square)](https://snyk.io/test/npm/pxl-for-emails)

## What for?

Are you sending html emails with your node.js app?

``` js
let emailMarkup = generateHtmlEmail() // E.g. using Foundation for Emails

sendEmail(addressTo, subject, emailMarkup) // E.g. using nodemailer
```

And do you want to track for each recipient if they open the email and on which links they click?

``` diff
  let emailMarkup = generateHtmlEmail()

+ emailMarkup = pxlForEmails.addTracking(emailMarkup, { recipient: addressTo })

  sendEmail(addressTo, subject, emailMarkup)
```

## Installation

[![NPM Stats](https://nodei.co/npm/pxl-for-emails.png?downloads=true)](https://npmjs.org/package/pxl-for-emails)

This is a module for node.js and is installed via npm:

``` bash
npm install pxl-for-emails --save
```

`pxl-for-emails` uses the [`pxl` library](https://github.com/analog-nico/pxl) to manage the tracking and has to be installed separately. Please check [its installation instructions](https://github.com/analog-nico/pxl#installation) for details.

## Usage

The [`pxl` library](https://github.com/analog-nico/pxl) manages the tracking and needs to be initialized first. Let's assume you use mongoDB in your app and thus we use the [`pxl-mongodb` library](https://github.com/analog-nico/pxl-mongodb) that extends `pxl` and stores all information in mongoDB.

``` js
let Pxl = require('pxl-mongodb') // Or use a different pxl variant for your preferred database

let pxl = new Pxl()
pxl.connect('mongodb://...')
```

`pxl-for-emails` will extend all urls by a `?pxl=trackingCode` query. You need to mount a middleware that "logs" all requests to these urls:
 
``` js
let app = express()

app.use(pxl.trackPxl)
```

Links to external resources need to be shortened and served by your Express app so that the requests pass through the `pxl.trackPxl` middleware. `pxl-for-emails` does the shortening for you. You only have to mount the middleware that redirects these shortened links to the external resources:

``` js
app.get('/shortly/:linkId', pxl.redirect)
```

`pxl` is now fully initialized. Now you can initialize `pxl-for-emails`:

``` js
let PxlForEmails = require('pxl-for-emails')

let pxlForEmails = new PxlForEmails({
    pxl,
    getFullShortenedLink(linkId) {
        return `https://localhost:3000/shortly/${ linkId }`
    }
})
```

Now you can execute the line in the introduction above:

``` js
emailMarkup = pxlForEmails.addTracking(emailMarkup, { recipient: addressTo })
```

`pxlForEmails.addTracking(...)` will create:

- 1 tracking code that counts how often the recipient opens the email
- 1 tracking code for each link in the email that counts how often the recipient clicks on that link

These tracking codes get stored in the database. For mongoDB it looks like this:

``` json
{
    "pxl": "somecode",
    "type": "click",
    "link": "http://externalblog.com/5-things-your-todo-list-is-missing",
    "count": 0
}
```

The second parameter you pass to `pxlForEmails.addTracking(...)` is metadata that is stored with it:

``` diff
  {
+     "recipient": "mail@example.com",
      "pxl": "somecode",
      "type": "click",
      "link": "http://externalblog.com/5-things-your-todo-list-is-missing",
      "count": 0
  }
```

The metadata is important for the analysis of the tracked data. Besides the recipient I usually also store which email was sent &ndash; e.g. "weekly update", "special offer" &ndash; and the date on which is was sent.

## Additional Options

[`pxl`](https://github.com/analog-nico/pxl) and [`pxl-mongodb`](https://github.com/analog-nico/pxl-mongodb) provide additional options for initialization. Check out their READMEs for details.

`pxl-for-emails` has the following default behavior if you initialize it as described in the Usage section above:

- The url of the first image in the email is used for open tracking
- If the email does not contain any images the email is marked as being opened once the user clicks on any link
- All links are extended for click tracking
- The image url and all links are categorized as external resources and thus are shortened

Use the additional options to change the default behavior.

### Select a specific or even multiple images for open tracking

Description forthcoming.

Btw, either shorten the image urls (default) or otherwise make sure you disable caching when serving the images that are used for open tracking. You may use [`nocache`](https://www.npmjs.com/package/nocache) to achieve this.

### Improve the open tracking if the email has no images

Just add a [1x1 transparent pixel image](http://www.1x1px.me) to your email (`<img src="...url..." alt="">` somewhere in its body) and let `pxl-for-emails` add open tracking to this image.

Btw, either shorten the image url (default) or otherwise make sure you disable caching when serving the image that is used for open tracking. You may use [`nocache`](https://www.npmjs.com/package/nocache) to achieve this.

### Add click tracking not to all but specific links

Description forthcoming.

### Do not shorten internal image urls / links

Requests to images and webpages which you host with your own Express app will pass through the `pxl.trackPxl` middleware. Thus it is not necessary to shorten them. All you need to do is to tell `pxl-for-emails` which urls to shorten and which not.

``` diff
  let pxlForEmails = new PxlForEmails({
      pxl,
+     openTracking: {
+         shouldApply(link) {
+             return {
+                 shorten: !link.startsWith('http://localhost:3000/')
+             }
+         }
+     }
+     clickTracking: {
+         shouldApply(link) {
+             return {
+                 shorten: !link.startsWith('http://localhost:3000/')
+             }
+         }
+     }
      getFullShortenedLink(linkId) {
          return `http://localhost:3000/shortly/${ linkId }`
      }
  })
```

Btw, if you don't shorten the image urls make sure you disable caching when serving the images that are used for open tracking. You may use [`nocache`](https://www.npmjs.com/package/nocache) to achieve this.

### Add categories to all links for easier data analysis

Your email may contain multiple sign up buttons or multiple links to your blog articles. All those links are tracked separately by default. However, you may want to analyze your data and answer "Did the recipient click on any sign up button?" or "Did the recipient visit our blog?". While you still want to be able to answer "Which sign up botton?" or "Which blog article?" &ndash; so separate tracking is important &ndash; the solution is to add categories like "sign up button" or "blog article" as additional metadata to the tracking records in the database. Then you can easily answer your questions by grouping the tracking records by their category.

Description forthcoming.

## Contributing

To set up your development environment for `pxl-for-emails`:

1. Clone this repo to your desktop,
2. in the shell `cd` to the main folder,
3. hit `npm install`,
4. hit `npm install gulp -g` if you haven't installed gulp globally yet, and
5. run `gulp dev`. (Or run `node ./node_modules/.bin/gulp dev` if you don't want to install gulp globally.)

`gulp dev` watches all source files and if you save some changes it will lint the code and execute all tests. The test coverage report can be viewed from `./coverage/lcov-report/index.html`.

If you want to debug a test you should use `gulp test-without-coverage` to run all tests without obscuring the code by the test coverage instrumentation.

## Change History

- v0.0.3 (2016-10-08)
    - Fix for adding tracking to urls with hashes
- v0.0.2 (2016-10-08)
    - By default, only the first image is used for open tracking
    - `shorten` attribute returned by `shouldApply` may be truthy or falsy instead of `true` or `false`
- v0.0.1 (2016-10-07)
    - Initial version

## License (ISC)

In case you never heard about the [ISC license](http://en.wikipedia.org/wiki/ISC_license) it is functionally equivalent to the MIT license.

See the [LICENSE file](LICENSE) for details.
