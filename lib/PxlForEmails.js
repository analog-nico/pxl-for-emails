'use strict'

let _ = require('lodash')
let BPromise = require('bluebird')
let stringReplaceAsync = require('string-replace-async')


function getMetadataForOpenTracking(metadata) {
    return _.assign({ type: 'open' }, metadata)
}

// function getMetadataForClickTracking(metadata, referToOpenTrackingPxl, openTrackingPxl) {
//     let fullMetadata = _.assign({ type: 'click' }, metadata)
//     if (referToOpenTrackingPxl && openTrackingPxl) {
//         fullMetadata.ref = openTrackingPxl
//     }
//     return fullMetadata
// }


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
                apply: (link, pxl) => {
                    return `${ link }${ link.match(/\?/) ? '&' : '?' }${ this.options.pxl.queryParam }=${ pxl }`
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
                    return `${ link }${ link.match(/\?/) ? '&' : '?' }${ this.options.pxl.queryParam }=${ pxl }`
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

        let openPxl = null

        return BPromise.try(() => {

            let fullMetadata = getMetadataForOpenTracking(metadata)

            return stringReplaceAsync.seq(
                htmlEmail,
                this.options.openTracking.regexLinks,
                BPromise.coroutine(function *(match, p1, link, p3) {

                    let applyInstruction = this.options.openTracking.shouldApply(link)
                    if (!applyInstruction) {
                        return match
                    }

                    if (!openPxl) {

                        if (applyInstruction.metadata) {
                            fullMetadata = _.assign(fullMetadata, applyInstruction.metadata)
                        }

                        let createdPxl = yield this.options.pxl.createPxl(fullMetadata)
                        openPxl = createdPxl.pxl

                    }

                    let linkToUse = applyInstruction.link || link

                    if (applyInstruction.shorten !== false) {

                        let shortenedlink = yield this.options.pxl.shorten(linkToUse)
                        linkToUse = this.options.getFullShortenedLink(shortenedlink.linkId)

                    }

                    return `${ p1 }${ this.options.openTracking.apply(linkToUse, openPxl) }${ p3 }` // eslint-disable-line prefer-reflect

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

        // let clickPxls = {}
        //
        // return BPromise.try(() => {
        //
        //     let fullMetadata = getMetadataForClickTracking(metadata, referToOpenTrackingPxl, openTrackingPxl)
        //
        //     return stringReplaceAsync.seq(
        //         htmlEmail,
        //         this.options.clickTracking.regexLinks,
        //         BPromise.coroutine(function *(match, p1, link, p3) {
        //
        //             let shouldApplyOrMetadata = this.options.clickTracking.shouldApply(link)
        //
        //             if (!shouldApplyOrMetadata) {
        //                 return match
        //             }
        //
        //             if (referToOpenTrackingPxl && !openTrackingPxl) {
        //                 openTrackingPxl = yield this.options.pxl.createPxl(getMetadataForOpenTracking(metadata))
        //                 fullMetadata = getMetadataForClickTracking(metadata, referToOpenTrackingPxl, openTrackingPxl)
        //             }
        //
        //             let linkToUse = link
        //             let metadataToUse = _.clone(fullMetadata)
        //             let createdPxl = null
        //
        //             if (!clickPxls[link]) {
        //
        //                 let externalLink = this.options.clickTracking.isExternalLink(link)
        //                 if (externalLink) {
        //                     let linkId = yield this.options.pxl.shorten(_.isString(externalLink) ? externalLink : link)
        //                     linkToUse = this.options.clickTracking.getFullShortenedLink(linkId)
        //                 }
        //
        //                 if (_.isObjectLike(shouldApplyOrMetadata)) {
        //                     metadataToUse = _.assign({}, metadataToUse, shouldApplyOrMetadata)
        //                 }
        //
        //                 createdPxl = yield this.options.pxl.createPxl(metadataToUse)
        //
        //                 clickPxls[link] = {
        //                     linkToUse,
        //                     metadataToUse,
        //                     createdPxl
        //                 }
        //
        //             } else {
        //
        //                 linkToUse = clickPxls[link].linkToUse
        //                 metadataToUse = clickPxls[link].metadataToUse
        //                 createdPxl = clickPxls[link].createdPxl
        //
        //             }
        //
        //             return `${ p1 }${ this.options.clickTracking.apply(linkToUse, createdPxl.pxl) }${ p3 }` // eslint-disable-line prefer-reflect
        //
        //         }).bind(this)
        //     )
        //
        // })

    }

}

module.exports = PxlForEmails
