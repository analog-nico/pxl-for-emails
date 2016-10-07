'use strict'

let _ = require('lodash')
let PxlForEmails = require('../../')
let sinon = require('sinon')

describe('PxlForEmails', () => {

    it('should validate during initialization', () => {

        expect(() => {
            new PxlForEmails() // eslint-disable-line no-new
        }).to.throw('Please pass options.pxl')

        expect(() => {
            new PxlForEmails({ pxl: {} }) // eslint-disable-line no-new
        }).to.throw('Please pass a function to options.getFullShortenedLink')

        expect(() => {
            new PxlForEmails({ pxl: {}, getFullShortenedLink: _.noop }) // eslint-disable-line no-new
        }).to.not.throw()

    })

    describe('should add open tracking', () => {

        let pxl = null
        let createPxlSpy = null
        let shortenSpy = null

        before(() => {
            pxl = {
                createPxl() {
                    return new Promise((resolve) => { resolve({ pxl: 'testpxl' }) })
                },
                shorten(link) {
                    return new Promise((resolve) => { resolve({ linkId: String(link.length) }) })
                },
                queryParam: 'pxl'
            }
            createPxlSpy = sinon.spy(pxl, 'createPxl')
            shortenSpy = sinon.spy(pxl, 'shorten')
        })

        beforeEach(() => {
            createPxlSpy.reset()
            shortenSpy.reset()
        })

        it('to all images', () => {

            let htmlEmail = 'abc<img src="http://google.com">test</img>def<img\n src="http://apple.com?iphone=next">test2</img>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    shouldApply(link) {
                        return {
                            shorten: false
                        }
                    }
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addOpenTracking(htmlEmail, { additional: true })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://google.com?pxl=testpxl">test</img>def<img\n src="http://apple.com?iphone=next&pxl=testpxl">test2</img>ghi')

                    expect(createPxlSpy.calledOnce).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'open',
                        additional: true
                    })

                })

        })

        it('to all images with shortening the links', () => {

            let htmlEmail = 'abc<img src="http://google.com">test</img>def<img\n src="http://apple.com?iphone=next">test2</img>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                getFullShortenedLink(linkId) {
                    return `http://mysite.com/ly/${ linkId }`
                }
            })

            return pxlForEmails.addOpenTracking(htmlEmail, { additional: true })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://mysite.com/ly/17?pxl=testpxl">test</img>def<img\n src="http://mysite.com/ly/28?pxl=testpxl">test2</img>ghi')

                    expect(createPxlSpy.calledOnce).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'open',
                        additional: true
                    })

                    expect(shortenSpy.calledTwice).to.eql(true)

                })

        })

        it('to all images with overwriting the metadata', () => {

            let htmlEmail = 'abc<img src="http://google.com">test</img>def<img\n src="http://apple.com?iphone=next">test2</img>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    shouldApply(link) {
                        return {
                            metadata: {
                                overwrittenBy: 'shouldApply',
                                extraShouldApply: true
                            },
                            shorten: false
                        }
                    }
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addOpenTracking(htmlEmail, { additional: true, type: 'custom', overwrittenBy: 'addOpenTracking' })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://google.com?pxl=testpxl">test</img>def<img\n src="http://apple.com?iphone=next&pxl=testpxl">test2</img>ghi')

                    expect(createPxlSpy.calledOnce).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'custom',
                        additional: true,
                        overwrittenBy: 'shouldApply',
                        extraShouldApply: true
                    })

                })

        })

        it('to specific image', () => {

            let htmlEmail = 'abc<img src="http://google.com">test</img>def<img\n src="http://apple.com?pxl">test2</img>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    shouldApply(link) {
                        return link.match(/\?pxl$/)
                            ? { link: link.split('?')[0], metadata: {}, shorten: false }
                            : false
                    }
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addOpenTracking(htmlEmail)
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://google.com">test</img>def<img\n src="http://apple.com?pxl=testpxl">test2</img>ghi')

                })

        })

        it('matching no images', () => {

            let htmlEmail = 'abc<img>test</img>def'

            let pxlForEmails = new PxlForEmails({ pxl, getFullShortenedLink: _.noop })

            return pxlForEmails.addOpenTracking(htmlEmail)
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql(htmlEmail)

                })

        })

        it('handling errors', () => {

            let pxlForEmails = new PxlForEmails({
                pxl: {
                    createPxl() {
                        return new Promise((resolve, reject) => { reject(new Error('test')) })
                    },
                    queryParam: 'pxl'
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addOpenTracking('<img src="http://google.com">test</img>')
                .then(() => {
                    throw new Error('Expected error')
                })
                .catch((err) => {
                    expect(err.message).to.eql('test')
                })

        })

    })

    // describe('should add click tracking', () => {
    //
    //     let pxl = null
    //     let createPxlSpy = null
    //
    //     before(() => {
    //         pxl = {
    //             createPxl() {
    //                 return new Promise((resolve) => { resolve({ pxl: 'testpxl' }) })
    //             },
    //             queryParam: 'pxl'
    //         }
    //         createPxlSpy = sinon.spy(pxl, 'createPxl')
    //     })
    //
    //     beforeEach(() => {
    //         createPxlSpy.reset()
    //     })
    //
    //     it('to all anchors', () => {
    //
    //         let htmlEmail = 'abc<a href="http://google.com">test</a>def<a\n href="http://apple.com?iphone=next">test2</a>ghi'
    //
    //         let pxlForEmails = new PxlForEmails({
    //             pxl,
    //             clickTracking: {
    //                 isExternalLink() { return false }
    //             },
    //             getFullShortenedLink: _.noop
    //         })
    //
    //         return pxlForEmails.addClickTracking(htmlEmail, { additional: true })
    //             .then((updatedHtmlEmail) => {
    //
    //                 expect(updatedHtmlEmail).to.eql('abc<a href="http://google.com?pxl=testpxl">test</a>def<a\n href="http://apple.com?iphone=next&pxl=testpxl">test2</a>ghi')
    //
    //                 expect(createPxlSpy.calledTwice).to.eql(true)
    //                 expect(createPxlSpy.firstCall.args[0]).to.eql({
    //                     type: 'click',
    //                     link: 'http://google.com',
    //                     additional: true
    //                 })
    //                 expect(createPxlSpy.secondCall.args[0]).to.eql({
    //                     type: 'click',
    //                     link: 'http://apple.com?iphone=next',
    //                     additional: true
    //                 })
    //
    //             })
    //
    //     })
    //
    // })

})
