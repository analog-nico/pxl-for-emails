'use strict'

let _ = require('lodash')
let BPromise = require('bluebird')
let stringReplaceAsync = require('string-replace-async')


function getMetadataForOpenTracking(metadata) {
    return _.assign({ type: 'open' }, metadata)
}

function getMetadataForClickTracking(metadata, referToOpenTrackingPxl, openTrackingPxl) {
    let fullMetadata = _.assign({ type: 'click' }, metadata)
    if (referToOpenTrackingPxl && openTrackingPxl) {
        fullMetadata.ref = openTrackingPxl
    }
    return fullMetadata
}

function addPxlToLink(link, pxlParam, pxlCode) {
    let [ urlAndQuery, hash = '' ] = link.split('#')
    return `${ urlAndQuery }${ urlAndQuery.includes('?') ? '&' : '?' }${ pxlParam }=${ pxlCode }${ hash === '' ? '' : '#' }${ hash }`
}


class PxlForEmails {

    constructor(options = {}) {

        this.options = _.defaultsDeep(options, {
            openTracking: {
                regexLinks: /(<img\s+(?:[^>]*?\s+)?src=")([^"]*)(")/ig,
                shouldApply(link) {
                    return {
                        link,
                        // metadata: {},
                        shorten: true
                    }
                },
                applyToFirstCandidateOnly: true,
                apply: (link, pxl) => {
                    return addPxlToLink(link, this.options.pxl.queryParam, pxl)
                }
            },
            clickTracking: {
                regexLinks: /(<a\s+(?:[^>]*?\s+)?href=")([^"]*)(")/ig,
                shouldApply(link) {
                    return {
                        link,
                        // metadata: {},
                        shorten: true
                    }
                },
                apply: (link, pxl) => {
                    return addPxlToLink(link, this.options.pxl.queryParam, pxl)
                }
            }
        })

        if (!this.options.pxl) {
            throw new Error('Please pass options.pxl')
        }

        if (!_.isFunction(this.options.getFullShortenedLink)) {
            throw new Error('Please pass a function to options.getFullShortenedLink')
        }

    }

    addTracking(htmlEmail, metadata) {

        return this.addOpenTracking(htmlEmail, metadata, true)
            .spread((updatedHtmlEmail, openTrackingPxl) => {
                return this.addClickTracking(updatedHtmlEmail, metadata, true, openTrackingPxl)
            })

    }

    addOpenTracking(htmlEmail, metadata, _internal = false) {

        let numCandidate = 0
        let openPxl = null
        let shortenedLinks = {}

        return BPromise.try(() => {

            let fullMetadata = getMetadataForOpenTracking(metadata)

            return stringReplaceAsync.seq(
                htmlEmail,
                this.options.openTracking.regexLinks,
                BPromise.coroutine(function *(match, p1, link, p3) {

                    if (this.options.openTracking.applyToFirstCandidateOnly && numCandidate > 0) {
                        return match
                    }

                    let applyInstruction = this.options.openTracking.shouldApply(link)
                    if (!applyInstruction) {
                        return match
                    }

                    if (!openPxl) {

                        if (applyInstruction.metadata) {
                            _.assign(fullMetadata, applyInstruction.metadata)
                        }

                        let createdPxl = yield this.options.pxl.createPxl(fullMetadata)
                        openPxl = createdPxl.pxl

                    }

                    let linkToUse = applyInstruction.link || link

                    if (_.isUndefined(applyInstruction.shorten) || applyInstruction.shorten) {

                        if (!shortenedLinks[linkToUse]) {

                            let shortenedlink = yield this.options.pxl.shorten(linkToUse)
                            shortenedLinks[linkToUse] = this.options.getFullShortenedLink(shortenedlink.linkId)

                        }

                        linkToUse = shortenedLinks[linkToUse]

                    }

                    let newLink = `${ p1 }${ this.options.openTracking.apply(linkToUse, openPxl) }${ p3 }` // eslint-disable-line prefer-reflect

                    numCandidate += 1

                    return newLink

                }).bind(this)
            )

        })
            .then((updatedHtmlEmail) => {

                if (_internal) {
                    return [ updatedHtmlEmail, openPxl ]
                }

                return updatedHtmlEmail

            })

    }

    addClickTracking(htmlEmail, metadata, referToOpenTrackingPxl, openTrackingPxl) {

        let shortenedLinks = {}

        return BPromise.try(() => {

            let fullMetadata = getMetadataForClickTracking(metadata, referToOpenTrackingPxl, openTrackingPxl)

            return stringReplaceAsync.seq(
                htmlEmail,
                this.options.clickTracking.regexLinks,
                BPromise.coroutine(function *(match, p1, link, p3) {

                    let applyInstruction = this.options.clickTracking.shouldApply(link)
                    if (!applyInstruction) {
                        return match
                    }

                    if (referToOpenTrackingPxl && !openTrackingPxl) {

                        let createdOpenPxl = yield this.options.pxl.createPxl(getMetadataForOpenTracking(metadata))
                        openTrackingPxl = createdOpenPxl.pxl

                        fullMetadata = getMetadataForClickTracking(metadata, referToOpenTrackingPxl, openTrackingPxl)

                    }

                    let linkToUse = applyInstruction.link || link
                    let metadataToUse = _.assign({ link: linkToUse }, fullMetadata)

                    if (applyInstruction.metadata) {
                        _.assign(metadataToUse, applyInstruction.metadata)
                    }

                    let createdPxl = yield this.options.pxl.createPxl(metadataToUse)
                    let clickPxl = createdPxl.pxl

                    if (_.isUndefined(applyInstruction.shorten) || applyInstruction.shorten) {

                        if (!shortenedLinks[linkToUse]) {

                            let shortenedlink = yield this.options.pxl.shorten(linkToUse)
                            shortenedLinks[linkToUse] = this.options.getFullShortenedLink(shortenedlink.linkId)

                        }

                        linkToUse = shortenedLinks[linkToUse]

                    }

                    return `${ p1 }${ this.options.clickTracking.apply(linkToUse, clickPxl) }${ p3 }` // eslint-disable-line prefer-reflect

                }).bind(this)
            )

        })

    }

}

module.exports = PxlForEmails
