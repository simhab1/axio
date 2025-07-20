import RunningData from "../../classes/models/RunningData"
import {WidgetsNestable} from "../../axiombuilder/models/WidgetsNestable"

/**
 * Helper functions for running axioms
 *
 */
export class AxiomApiHelper {

    /**
     * Transpose table data - swapping rows and columns
     * @param {*} array a 2D array e.g. [[item1a, item1b], [item2a, item2b]]
     * @example AxiomApiHelper.transpose([[item1a, item1b], [item2a, item2b]])
     * @returns a 2D array e.g. [[item1a, item2a], [item1b, item2b]]
     */
    static transpose(array) {
        let subArrayLength = 0
        let newArray = []
        for (let i = 0; i < array.length; i++) {
            if (array[i].length > subArrayLength) {
                subArrayLength = array[i].length
            }
        }
        for (let i = 0; i < subArrayLength; i++) {
            newArray.push([]);
        }
        for (let i = 0; i < array.length; i++) {
            for(let j = 0; j < subArrayLength; j++) {
                let jn = parseInt(j)
                newArray[jn].push(array[i][jn])
            }
        }

        return newArray;
    }

    /** 
    *
    * Introduce a delay with a promise
    * @param time - The time in milliseconds to delay
    *
    */

    static delay(time, v) {
        return new Promise(function(resolve) { 
            setTimeout(resolve.bind(null, v), time)
        });
     }

    /**
     * Convert a numerical index value into the column letter format
     * used by spreadsheet applications i.e. 0 => 'A', 26 => 'AA', 30 => 'AE'
     * @param {*} index the index of the column you want the corresponding column letter for e.g. 0
     * @example AxiomApiHelper.getColLetter(30)
     * @result a string representing the column in a spreadsheet that corresponds to the numerical index given e.g. 'AE'
     */
    static getColLetter(index) {
        let ALPHA = ['!', 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

        let base = ALPHA.length-1
        let n = index

        let done = false
        let res = []
        let colLetters = ''

        while (!done) {
            let a = (n / base)
            let remainder = (n % base)
            if (res.length == 0) {
                remainder += 1
            }
            res.push(remainder)
            colLetters = ALPHA[remainder] + colLetters
            n = Math.round(a - (remainder / base))
            done = (n == 0)
        }

        return colLetters
    }

    /**
     * Convert the column letter format value into a numerical index
     * used by spreadsheet applications i.e. 'A' => 0, 'AA' => 26, 'AE' => 30
     * @param {*} colLetters
     * @example AxiomApiHelper.getColIndex('AE')
     * @returns a numerical index e.g. 30
     */
    static getColIndex(colLetters) {
        if (!colLetters) {
            return -1
        }
        colLetters = colLetters.trim()
        if (parseInt(colLetters, 10) >= 0) {
            return colLetters
        }
        let s_numbers = [0];
        for (let i = 0; i < colLetters.length; i++) {
            let pow = Math.pow(26, colLetters.length - i - 1)
            s_numbers[i] = (colLetters[i].charCodeAt(0) - 64) * pow
        }
        return s_numbers.reduce((accumulator, a) => {return accumulator + a}) - 1
    }

    /**
     * Check whether a 2D array contains a 1D array
     *
     * usefull for checking whether row data exists in table data
     *
     * If columns are provided as a param then
     * the arrays will only be compared by the contents of those columns
     * and not the entire contents of each array
     * @param {*} array1 a single dimensional array e.g. ["A", "Example A"]
     * @param {*} array2 a two dimensional array e.g. [["A", "Example A"], ["B", "Example B"]]
     * @param {*} columns an array of column letters to compare by
     * @example AxiomApiHelper.inArray(["A", "Example A"], [["A", "Example A"], ["B", "Example B"]])
     * @returns a boolean value e.g. true
     */
    static inArray(array1, array2, columns = null) {
        let found = false

        for (let array of array2) {
            if (this.matchingArrays(array, array1, columns)) {
                found = true
            }
        }
        return found
    }

    static colString2indexArray(cols) {
        let indeces = []
        for (let col of cols.split(',')) {
            col = col.trim()
            if (Number.isInteger(col)) {
                col = col -1
            } else {
                if (/[A-Za-z]/.test(col)) {
                    if (/[a-z]/.test(col)) {
                        col = col.toUpperCase()
                    }
                    col = this.getColIndex(col)
                } else {
                    col = Number(col) - 1
                }
            }
            if (col > -1){
                indeces.push(col)
            }
        }

        return indeces
    }

    /**
     * Checks whether two single dimensional arrays match - for comparing whether two rows of data match
     *
     * If columns are provided as a param then
     * the arrays will only be compared by the contents of those columns
     * and not the entire contents of each array
     * @param {*} array1 the first array to compare
     * @param {*} array2 the second array to compare against
     * @param {*} columns an array of columns letters to compare within each array e.g. ['A','D']
     * @example AxiomApiHelper.matchingArrays([0,0,0,0], [0,2,1,0], ['A','D'])
     * @return a boolean value e.g. true
     */
    static matchingArrays(array1, array2, columns = null) {
        let singleDimension = true
        if (array1.length != array2.length) {
            return false
        }
        if (Array.isArray(array1) != Array.isArray(array2)) {
            return false
        } else {
            if (Array.isArray(array1)) {
                singleDimension = false
            }
        }
        let matching = true

        if (Array.isArray(columns) && columns.length > 0) {
        } else {
            columns = []
            let tableWidth = (array1.length > array2.length) ? array1.length : array2.length
            for (let i = 0; i < tableWidth; i ++) {
                columns.push(this.getColLetter(i+1))
            }
        }

        for (let colLetters of columns) {
            let i = this.getColIndex(colLetters)

            if (array1[i] != array2[i]) {
                matching = false
            }
        }

        return matching
    }

    static clone(array) {
        if (!array) {
            return [[""]]
        }
        let cloned = []
        if (Array.isArray(array[0])) {
            for (let item of array) {
                cloned[array.indexOf(item)] = this.clone(item)
            }
        } else {
            for (let key of Object.keys(array)) {
                cloned[key] = array[key].valueOf()
            }
        }
        return cloned
    }

    static getRoute(url) {
        let domain = url
        if (/\/\//.test(url)) {
            var split = url.split('//')
            var protocol = split[0]
            domain = split[split.length -1]
            var domainSegs = domain.split('.')
            if (domainSegs.length > 2) {
                var net = domainSegs.shift()
            }
            let route = domainSegs.pop()
            route = route.split('/')
            route.pop()
            domain = domainSegs.join('.') + '.' + route.join('/')
        }
        return domain
    }

    /**
     * Send a message to the tab window.
     */
    static sendTabMessage(action, params) {
        return new Promise((resolve, reject) => {
            let rd = new RunningData()
            rd.load().then(async () => {
                let tab_id
                try { 
                    tab_id = rd.states[0].tab_id
                } catch (e) {
                    // To stop javascript doing its normal idiot thing
                }
                if (!tab_id) {
                    // If we have no tab id, try and find one in which axiom is loaded
                    tab_id = await new Promise(resolve2 => {
                        chrome.tabs.query({}, (tabs) => {
                            for (let tab of tabs) {
                                chrome.tabs.sendMessage(tab.id, {action: 'is_loaded'}, response => {
                                    if (response) {
                                        resolve2(tab.id)
                                    }
                                })
                            }
                        })
                        setTimeout(() => {
                            resolve2(null)
                        }, 2000)
                    })
                }
                params.action = action
                chrome.tabs.sendMessage(tab_id, params, response => {
                    if (chrome.runtime.hasOwnProperty("lastError")) {
                        switch (action) {
                            case "display_message":
                                resolve('')
                                break
                            default:
                                resolve({error: {message: chrome.runtime.lastError.message}})
                                break
                        }
                    } else {
                        resolve(response)
                    }
                })
            })
        })
    }

    static isValidJson(str) {
        try {
            const obj = JSON.parse(str)

            if (obj && typeof obj === 'object') {
                return true
            }
        } catch (e) {
        }

        return false
    }

    static buildSelectorArray(selector, resultType) {
        let selectors = []
        let resultTypes = []
        if (!Array.isArray(selector)) {
            if (typeof selector === 'string') {
                selectors = selector.split(',')// TODO - replace with split
                let trimmed = []
                for (let s of selectors) {
                    trimmed.push(s.trim())
                    if (typeof resultType === 'string') {
                        resultTypes.push(resultType)
                    } else {
                        resultTypes.push('textContent')
                    }
                }
                selectors = trimmed
            }
        } else {
            if (selector[0].resultType !== undefined) {
                resultTypes = selector.map(s => {
                    return s.resultType
                })
                selectors = selector.map(s => {
                    return s.selector
                })
            }
        }
        return {selectors, resultTypes}
    }

    static applyToIframes(callback) {
        jQuery('iframe').each((index, el) => {
            const content = jQuery(el).contents()
            if (content && content.length) {
                callback(index, content)
            }
        })
    }

    /**
     * Extracts form data from an axiom / task object
     * @param {} task 
     */
    static extractFormData(task, keepDisabled = false) {
        let formData = []
        while (typeof task.data === 'string') {
            task.data = JSON.parse(task.data)
        }
        // remove all disabled widgets from task before run.
        // used `for in` to take the index
        for (let wid in task.data.form) {
            if(keepDisabled || !(task.data.form[wid].is_disable !== undefined && task.data.form[wid].is_disable === true)) {
                formData.push(task.data.form[wid])
            }
        }
        return formData
    }

    /**
     * Loads the campaign cookie from the Axiom website, if one is set
     */
    static async getCampaign() {
        return new Promise(resolve => {
            chrome.cookies.getAll({name: "axiom_ga_query_params"}, res => {
                if (res.length > 0) {
                    const desiredCookie = res.filter(item => item.path === '/')[0]
                    if (desiredCookie) {
                        resolve(desiredCookie.value)
                    } else {
                        resolve(res[0].value)
                    }
                } else {
                    resolve('')
                }
            })
        })
    }

    static getStepNumbering(widgets, nestingData) {
        if (!nestingData) {
            const wn = new WidgetsNestable()
            nestingData = wn.buildNestingData(widgets)
        }
        let parts = [0, 0, 0, 0, 0]
        for (let windex in nestingData) {
            if (!nestingData[windex].endingBlock) {
                parts[nestingData[windex].indent]++
            } else if (nestingData[windex-1] && nestingData[windex-1].indent > nestingData[windex].indent) {
                parts[nestingData[windex-1].indent] = 0
            }
            widgets[windex].stepNumber = parts.slice(0, nestingData[windex].indent + 1).join('.')
        }
    }

    static getTrimmedUrl(url) {
        try {
            let trimmed = url.trim().toLowerCase()
            let urlObject = new URL(trimmed)

            urlObject.hash = ''
            urlObject.search = ''
            urlObject.pathname = ''

            return urlObject.toString()
        } catch(e) {
            return url
        }
    }
}
