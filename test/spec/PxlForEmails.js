'use strict'

let _ = require('lodash')
let fs = require('fs')
let path = require('path')
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
                    return new Promise((resolve) => { resolve({ linkId: `id${ shortenSpy.callCount }` }) })
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

            let htmlEmail = 'abc<img src="http://google.com"/>testdef<img\n src="http://apple.com?iphone=next">test2ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    applyToFirstCandidateOnly: false,
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

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://google.com?pxl=testpxl"/>testdef<img\n src="http://apple.com?iphone=next&pxl=testpxl">test2ghi')

                    expect(createPxlSpy.calledOnce).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'open',
                        additional: true
                    })

                })

        })

        it('to all images with shortening the links', () => {

            let htmlEmail = 'abc<img src="http://google.com"/>testdef<img\n src="http://apple.com?iphone=next">test2ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    applyToFirstCandidateOnly: false
                },
                getFullShortenedLink(linkId) {
                    return `http://mysite.com/ly/${ linkId }`
                }
            })

            return pxlForEmails.addOpenTracking(htmlEmail, { additional: true })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://mysite.com/ly/id1?pxl=testpxl"/>testdef<img\n src="http://mysite.com/ly/id2?pxl=testpxl">test2ghi')

                    expect(createPxlSpy.calledOnce).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'open',
                        additional: true
                    })

                    expect(shortenSpy.calledTwice).to.eql(true)

                })

        })

        it('to all images with shortening the links and repeating links', () => {

            let htmlEmail = 'abc<img src="http://google.com"/>testdef<img\n src="http://apple.com">def<img\n src="http://apple.com">def<img\n src="http://apple.com?iphone=next">test2ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    applyToFirstCandidateOnly: false,
                    shouldApply(link) {
                        return {
                            link: link.split('?')[0]
                        }
                    }
                },
                getFullShortenedLink(linkId) {
                    return `http://mysite.com/ly/${ linkId }`
                }
            })

            return pxlForEmails.addOpenTracking(htmlEmail, { additional: true })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://mysite.com/ly/id1?pxl=testpxl"/>testdef<img\n src="http://mysite.com/ly/id2?pxl=testpxl">def<img\n src="http://mysite.com/ly/id2?pxl=testpxl">def<img\n src="http://mysite.com/ly/id2?pxl=testpxl">test2ghi')

                    expect(createPxlSpy.calledOnce).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'open',
                        additional: true
                    })

                    expect(shortenSpy.calledTwice).to.eql(true)

                })

        })

        it('to all images with overwriting the metadata', () => {

            let htmlEmail = 'abc<img src="http://google.com"/>testdef<img\n src="http://apple.com?iphone=next">test2ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    applyToFirstCandidateOnly: false,
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

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://google.com?pxl=testpxl"/>testdef<img\n src="http://apple.com?iphone=next&pxl=testpxl">test2ghi')

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

            let htmlEmail = 'abc<img src="http://google.com"/>testdef<img\n src="http://apple.com?pxl">test2ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                openTracking: {
                    applyToFirstCandidateOnly: false,
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

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://google.com"/>testdef<img\n src="http://apple.com?pxl=testpxl">test2ghi')

                })

        })

        it('to first specific image', () => {

            let htmlEmail = 'abc<img src="http://google.com"/>testdef<img\n src="http://apple.com?pxl">test2ghi<img\n src="http://apple.com?pxl">test2ghi'

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

                    expect(updatedHtmlEmail).to.eql('abc<img src="http://google.com"/>testdef<img\n src="http://apple.com?pxl=testpxl">test2ghi<img\n src="http://apple.com?pxl">test2ghi')

                })

        })

        it('matching no images', () => {

            let htmlEmail = 'abc<img>testdef'

            let pxlForEmails = new PxlForEmails({ pxl, getFullShortenedLink: _.noop })

            return pxlForEmails.addOpenTracking(htmlEmail)
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql(htmlEmail)

                    expect(createPxlSpy.callCount).to.eql(0)
                    expect(shortenSpy.callCount).to.eql(0)

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

            return pxlForEmails.addOpenTracking('<img src="http://google.com">test')
                .then(() => {
                    throw new Error('Expected error')
                })
                .catch((err) => {
                    expect(err.message).to.eql('test')
                })

        })

    })

    describe('should add click tracking', () => {

        let pxl = null
        let createPxlSpy = null
        let shortenSpy = null

        before(() => {
            pxl = {
                createPxl() {
                    return new Promise((resolve) => { resolve({ pxl: `testpxl${ createPxlSpy.callCount }` }) })
                },
                shorten(link) {
                    return new Promise((resolve) => { resolve({ linkId: `id${ shortenSpy.callCount }` }) })
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

        it('to all anchors', () => {

            let htmlEmail = 'abc<a wronghref="wrong" href="http://google.com">test</a>def<a \nhref="http://apple.com?iphone=next">test2</a>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                clickTracking: {
                    shouldApply(link) {
                        return {
                            shorten: false
                        }
                    }
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addClickTracking(htmlEmail, { additional: true })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<a wronghref="wrong" href="http://google.com?pxl=testpxl1">test</a>def<a \nhref="http://apple.com?iphone=next&pxl=testpxl2">test2</a>ghi')

                    expect(createPxlSpy.calledTwice).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://google.com',
                        additional: true
                    })
                    expect(createPxlSpy.secondCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://apple.com?iphone=next',
                        additional: true
                    })

                })

        })

        it('to all anchors with shortening the links', () => {

            let htmlEmail = 'abc<a wronghref="wrong" href="http://google.com">test</a>def<a \nhref="http://apple.com?iphone=next">test2</a>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                getFullShortenedLink(linkId) {
                    return `http://mysite.com/ly/${ linkId }`
                }
            })

            return pxlForEmails.addClickTracking(htmlEmail, { additional: true })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<a wronghref="wrong" href="http://mysite.com/ly/id1?pxl=testpxl1">test</a>def<a \nhref="http://mysite.com/ly/id2?pxl=testpxl2">test2</a>ghi')

                    expect(createPxlSpy.calledTwice).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://google.com',
                        additional: true
                    })
                    expect(createPxlSpy.secondCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://apple.com?iphone=next',
                        additional: true
                    })

                    expect(shortenSpy.calledTwice).to.eql(true)

                })

        })

        it('to all anchors with shortening the links and repeating links', () => {

            let htmlEmail = 'abc<a wronghref="wrong" href="http://google.com">test</a>def<a href="http://apple.com">xyz</a>def<a href="http://apple.com">xyz</a>123<a \nhref="http://apple.com?iphone=next">test2</a>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                clickTracking: {
                    shouldApply(link) {
                        return {
                            link: link.split('?')[0]
                        }
                    }
                },
                getFullShortenedLink(linkId) {
                    return `http://mysite.com/ly/${ linkId }`
                }
            })

            return pxlForEmails.addClickTracking(htmlEmail, { additional: true })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<a wronghref="wrong" href="http://mysite.com/ly/id1?pxl=testpxl1">test</a>def<a href="http://mysite.com/ly/id2?pxl=testpxl2">xyz</a>def<a href="http://mysite.com/ly/id2?pxl=testpxl3">xyz</a>123<a \nhref="http://mysite.com/ly/id2?pxl=testpxl4">test2</a>ghi')

                    expect(createPxlSpy.callCount).to.eql(4)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://google.com',
                        additional: true
                    })
                    expect(createPxlSpy.secondCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://apple.com',
                        additional: true
                    })
                    expect(createPxlSpy.thirdCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://apple.com',
                        additional: true
                    })
                    expect(createPxlSpy.args[3][0]).to.eql({
                        type: 'click',
                        link: 'http://apple.com',
                        additional: true
                    })

                    expect(shortenSpy.calledTwice).to.eql(true)

                })

        })

        it('to all anchors with creating open tracking pxl', () => {

            let htmlEmail = 'abc<a wronghref="wrong" href="http://google.com">test</a>def<a \nhref="http://apple.com?iphone=next">test2</a>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                clickTracking: {
                    shouldApply(link) {
                        return {
                            shorten: false
                        }
                    }
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addClickTracking(htmlEmail, { additional: true }, true)
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<a wronghref="wrong" href="http://google.com?pxl=testpxl2">test</a>def<a \nhref="http://apple.com?iphone=next&pxl=testpxl3">test2</a>ghi')

                    expect(createPxlSpy.calledThrice).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'open',
                        additional: true
                    })
                    expect(createPxlSpy.secondCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://google.com',
                        additional: true,
                        ref: 'testpxl1'
                    })
                    expect(createPxlSpy.thirdCall.args[0]).to.eql({
                        type: 'click',
                        link: 'http://apple.com?iphone=next',
                        additional: true,
                        ref: 'testpxl1'
                    })

                })

        })

        it('to all anchors with overwriting the metadata', () => {

            let htmlEmail = 'abc<a wronghref="wrong" href="http://google.com">test</a>def<a \nhref="http://apple.com?iphone=next">test2</a>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                clickTracking: {
                    shouldApply(link) {
                        let ret = {
                            metadata: {
                                overwrittenBy: 'shouldApply',
                                extraShouldApply: true
                            },
                            shorten: false
                        }
                        if (link === 'http://google.com') {
                            ret.metadata.link = 'otherlink'
                        }
                        return ret
                    }
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addClickTracking(htmlEmail, { additional: true, type: 'custom', overwrittenBy: 'addOpenTracking' }, true, 'openpxl')
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<a wronghref="wrong" href="http://google.com?pxl=testpxl1">test</a>def<a \nhref="http://apple.com?iphone=next&pxl=testpxl2">test2</a>ghi')

                    expect(createPxlSpy.calledTwice).to.eql(true)
                    expect(createPxlSpy.firstCall.args[0]).to.eql({
                        type: 'custom',
                        link: 'otherlink',
                        additional: true,
                        overwrittenBy: 'shouldApply',
                        extraShouldApply: true,
                        ref: 'openpxl'
                    })
                    expect(createPxlSpy.secondCall.args[0]).to.eql({
                        type: 'custom',
                        link: 'http://apple.com?iphone=next',
                        additional: true,
                        overwrittenBy: 'shouldApply',
                        extraShouldApply: true,
                        ref: 'openpxl'
                    })

                })

        })

        it('to specific anchor', () => {

            let htmlEmail = 'abc<a wronghref="wrong" href="http://google.com">test</a>def<a \nhref="http://apple.com?iphone=next">test2</a>ghi'

            let pxlForEmails = new PxlForEmails({
                pxl,
                clickTracking: {
                    shouldApply(link) {
                        return link.match(/\?iphone/)
                            ? { link: link.split('?')[0], metadata: {}, shorten: false }
                            : false
                    }
                },
                getFullShortenedLink: _.noop
            })

            return pxlForEmails.addClickTracking(htmlEmail)
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('abc<a wronghref="wrong" href="http://google.com">test</a>def<a \nhref="http://apple.com?pxl=testpxl1">test2</a>ghi')

                })

        })

        it('matching no anchor', () => {

            let htmlEmail = 'abc<a>test</a>def'

            let pxlForEmails = new PxlForEmails({ pxl, getFullShortenedLink: _.noop })

            return pxlForEmails.addClickTracking(htmlEmail)
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql(htmlEmail)

                    expect(createPxlSpy.callCount).to.eql(0)
                    expect(shortenSpy.callCount).to.eql(0)

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

            return pxlForEmails.addClickTracking('<a href="http://google.com">test</a>')
                .then(() => {
                    throw new Error('Expected error')
                })
                .catch((err) => {
                    expect(err.message).to.eql('test')
                })

        })

    })

    describe('should add open and click tracking', () => {

        let pxlForEmails = null
        let createPxlSpy = null
        let shortenSpy = null

        before(() => {

            let pxl = {
                createPxl() {
                    return new Promise((resolve) => { resolve({ pxl: `pxl${ createPxlSpy.callCount }` }) })
                },
                shorten(link) {
                    return new Promise((resolve) => { resolve({ linkId: `id${ shortenSpy.callCount }` }) })
                },
                queryParam: 'sqr'
            }
            createPxlSpy = sinon.spy(pxl, 'createPxl')
            shortenSpy = sinon.spy(pxl, 'shorten')

            pxlForEmails = new PxlForEmails({
                pxl,
                getFullShortenedLink(linkId) {
                    return `http://mysite.com/ly/${ linkId }`
                }
            })

        })

        beforeEach(() => {
            createPxlSpy.reset()
            shortenSpy.reset()
        })

        it('to simple template', () => {

            let htmlEmail = '<img src="img1"><a href="anchor1">'

            return pxlForEmails.addTracking(htmlEmail, { some: 'value' })
                .then((updatedHtmlEmail) => {

                    expect(updatedHtmlEmail).to.eql('<img src="http://mysite.com/ly/id1?sqr=pxl1"><a href="http://mysite.com/ly/id2?sqr=pxl2">')

                })

        })

        it('to real life template', () => {

            let htmlEmail = fs.readFileSync(path.join(__dirname, '../fixtures/template-before.html'), 'utf-8')

            return pxlForEmails.addTracking(htmlEmail, { some: 'value' })
                .then((updatedHtmlEmail) => {

                    // fs.writeFileSync(path.join(__dirname, './result.html'), updatedHtmlEmail)

                    expect(updatedHtmlEmail).to.eql(fs.readFileSync(path.join(__dirname, '../fixtures/template-after.html'), 'utf-8'))

                })

        })

    })

})
