import {AxiomApiHelper} from "./AxiomApiHelper"
import {AxiomApiUtilities} from "./AxiomApiUtilities"

/**
 * Filter and manipulate data sets.
 */
export class AxiomApiFilters {
    /**
     * Returns matching elements from a passed array of arrays. Matches are only returned if they are in every sub-array.
     * @param inputs An array of n arrays.
     * @returns {Array} Array of elements that appeared in every sub array of the inputs.
     */
    static matching(inputs) {
        let allInputs = []
        let output = []
        const matchesRequired = inputs.length
        for (const input of inputs) {
            allInputs = allInputs.concat(input)
        }
        for (const comp of allInputs) {
            let matches = 0
            for (const to of allInputs) {
                if (comp === to) {
                    matches++
                }
            }
            if (matches >= matchesRequired) {
                let skip = false
                for (const o of output) {
                    if (o === comp) {
                        skip = true
                        break
                    }
                }
                if (!skip) {
                    output.push(comp)
                }
            }
        }

        return output
    }

    /**
     * Flattens the passed array of arrays, filtering out all duplicate entries.
     * @param inputs An array of n arrays.
     * @returns {Array} A 1d array containing all unique values.
     */
    static flatten(inputs) {
        let output = []
        for (const input of inputs) {
            output = output.concat(input)
        }
        for (const comp in output) {
            for (const to in output) {
                if (output[comp] === output[to] && comp !== to) {
                    output.splice(to, 1)
                }
            }
        }

        return output
    }

    /**
     * Given an array of arrays and a set of columns to check on, removes any duplicate rows.
     * @param inputs An array of n arrays.
     * @param cols An array of column numbers to check for duplicates on.
     * @returns {Array} The inputs array, with duplicate rows removed.
     */
    static dedupe(inputs, cols) {
        if (cols.length === 0) {
            // This assumes the data is even, which it should be in a normal use.
            for (const col in inputs[0]) {
                cols.push(col)
            }
        }
        // No reverse function? Don't try and do anything, inputs is blank
        if (!inputs.reverse) {
            return []
        }
        // Reverse in order to keep the earliest item in the array without being annoying
        let outputs = inputs.reverse()
        return outputs.filter((item, key) => {
            for (let comp = key; comp < outputs.length; comp++) {
                if (comp !== key) {
                    let dupe = true
                    for (let c of cols) {
                        let replacedCol = AxiomApiHelper.getColIndex(c)
                        if (typeof item[replacedCol] === 'undefined') {
                            item[replacedCol] = ''
                        }
                        if (typeof outputs[comp][replacedCol] === 'undefined') {
                            outputs[comp][replacedCol] = ''
                        }
                        if (outputs[comp][replacedCol] !== item[replacedCol]) {
                            dupe = false
                            break
                        }
                    }
                    if (dupe) {
                        return false
                    }
                }
            }
            return true
        }).reverse()
    }

    /**
     * Given an array or arrays and an array of values, returns all rows that match at least one of the passed values.
     * @param inputs An array of n arrays.
     * @param values An array containing the values to check against
     * @returns {Array} An array of arrays, with rows not matching any value removed.
     */
    static hasAnyValue(inputs, values) {
        let outputs = []
        for (const row in inputs) {
            let hasVal = false
            for (const targetVal of values) {
                for (const colVal of inputs[row]) {
                    if (colVal === targetVal) {
                        hasVal = true
                        break
                    }
                }
                if (!hasVal) {
                    break
                }
            }
            if (hasVal) {
                outputs.push(inputs[row])
            }
        }

        return outputs
    }

    static _wordFilterSetup(inputs, word, cols) {
        let indices = []
        if (cols && cols.trim() != '') {
            indices = AxiomApiHelper.colString2indexArray(cols)
        }
        let words = word
        if (!Array.isArray(word)) {
            words = [word]
        }
        return {cols, indices, words}
    }

    static _wordFilterRecursive(inputs, words, indices, searchmode, start, results, test, exact, callback) {
        // If no words to filter on are passed then return the input data untouched
        const emptyWords = words.every(element => !element || (element && !element.trim))

        if (emptyWords) {
            callback(inputs)
            return
        }

        const all = (searchmode === 'all')
        let currIndex = start
        let loopsToBreak = 2000
        let i = 0
        while (i < loopsToBreak && inputs[currIndex]) {
            let row = inputs[currIndex]
            let rowString = ""
            if (indices.length > 0) {
                for (let j = 0; j < row.length; j++) {
                    rowString += (indices.includes(j)) ? row[j] + " " : ''
                }
            } else {
                for (let j = 0; j < row.length; j++) {
                    rowString += row[j] + " "
                }
            }
            let anyMatch = false
            let allMatch = true
            for (let word of words) {
                // Escape special characters that would mash up the regex expression
                word = word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

                if (exact) {
                    if (rowString.match(new RegExp(`\\b${word}\\b`, 'gi'))) {
                        anyMatch = true
                    } else {
                        allMatch = false
                    }
                } else {
                    if (rowString.match(new RegExp(word, 'gi'))) {
                        anyMatch = true
                    }
                    else {
                        allMatch = false
                    }
                }

                i++
            }
            if (all ? allMatch == test : anyMatch == test) {
                results.push(row)
            }
            i++
            currIndex++
        }
        if (currIndex < inputs.length) {
            setTimeout(() => {
                AxiomApiFilters._wordFilterRecursive(inputs, words, indices, searchmode, currIndex, results, test, exact, callback)
            }, 5)
        }
        else {
            callback(results)
        }
    }

    static matchWordBatched(inputs, word, callback, all = true, cols = '', exact) {
        let searchmode
        all ? searchmode = 'all' : searchmode = 'any'
        const setup = AxiomApiFilters._wordFilterSetup(inputs, word, cols)
        AxiomApiFilters._wordFilterRecursive(inputs, setup.words, setup.indices, searchmode, 0, [], true, exact, callback)
    }

    /**
     * Given an array of arrays, returns all arrays that do not contain the given words.
     * The batched version of this function works on larger datasets.
     * @param inputs
     * @param word
     * @param cols
     */
    static removeWordBatched(inputs, word, callback, cols = '', searchmode = 'any', exact) {
        let setup = AxiomApiFilters._wordFilterSetup(inputs, word, cols)
        AxiomApiFilters._wordFilterRecursive(inputs, setup.words, setup.indices, searchmode, 0, [], false, exact, callback)
    }

    /**
     * Given an array of arrays as a data input, and an array of strings tfo match against, returns all rows in the input
     * that contain at least one of the strings found in the match array.
     * DEPRECATED: Please use matchWordBatched for better performance!
     * @param inputs An array of arrays.
     * @param word An array of allowed words.
     * @param all Whether all words need to match (true|false)
     * @param cols A comma separated string of columns to apply to the filter to, defaults to all columns
     */
    static matchWord(inputs, word, all = true, cols = '') {
        let indeces = []
        if (cols && cols.trim() != '') {
            indeces = AxiomApiHelper.colString2indexArray(cols)
        } else {
            for (let i = 0; i < inputs[0].length; i++) {
                indeces.push(i)
            }
        }
        let words = word
        if (!Array.isArray(word)) {
            words = [word]
        }
        const outputs = inputs.filter(row => {
            let rowString = ""
            for (let i = 0; i < row.length; i ++) {
                rowString += (indeces.includes(i)) ? row[i] : ''
            }
            let anyMatch = false
            let allMatch = true
            for (let word of words) {
                if (rowString.match(new RegExp(word, 'i'))) {
                    anyMatch = true
                }
                else {
                    allMatch = false
                }
            }
            return (all ? allMatch : anyMatch)
        })
        return outputs
    }

    /**
     * Given an array of arrays, returns all arrays that do not contain the given words
     * DEPRECATED: Please use removeWordBatched for better performance!
     * @param inputs
     * @param word
     * @param cols
     */
    static removeWord(inputs, word, cols = '', searchMode = 'any') {
        // set things up
        let indeces = []
        if (cols && cols.trim() != '') {
            indeces = AxiomApiHelper.colString2indexArray(cols)
        } else {
            for (let i = 0; i < inputs[0].length; i++) {
                indeces.push(i)
            }
        }
        let words = word
        if (!Array.isArray(word)) {
            words = [word]
        }
        let all = (searchMode === 'all')
        // begin the filter
        const outputs = inputs.filter(row => {
            let rowString = ""
            for (let i = 0; i < row.length; i ++) {
                rowString += (indeces.includes(i)) ? row[i] : ''
            }
            let anyMatch = false
            let allMatch = true
            for (let word of words) {
                if (rowString.match(new RegExp(word, 'i'))) {
                    anyMatch = true
                }
                else {
                    allMatch = false
                }
            }
            return (all ? !allMatch : !anyMatch)
        })
        return outputs
    }

    /**
     * Given an array of arrays of strings: splits each string at any <br/> tags, creating new array of arrays of strings
     * @param inputs An array of arrays of strings
     */
    static lineBreakSplit(inputs){
        if (!Array.isArray(inputs)) {
            throw("inputs must be an array of arrays.")
        } else if (!Array.isArray(inputs[0])) {
            throw("inputs must be an array of arrays.")
        }
        let outputs = []
        for (const arr of inputs) {
            let newArr = []
            for (const item of arr) {
                let strings = item.split(/<br\/>|<br>/)
                for (const str of strings) {
                    newArr.push(str)
                }
            }
            outputs.push(newArr)
        }

        return outputs
    }

    /**
     * Given an array of arrays of HTML strings: splits each HTML string by a given tag, creating new array elements
     * @param inputs An array of arrays of strings
     * @param targetTags An array of tags (as strings) to split by (HTML tag e.g. 'div')
     * @param excludeOtherTags Set true or false whether to exclude content of tags not included in targetTags
     */
    static splitInnerHTML(inputs, targetTags, excludeOtherTags = false) {
        if (!Array.isArray(inputs)) {
            throw("inputs must be an array of arrays.")
        }
        if (!Array.isArray(targetTags) || targetTags.length === 0) {
            throw("targetTags must be an array of tags to split.")
        }
        function filterHTML(inputs){
            let outputs = []

            for (const arr of inputs) {
                let newArr = []
                for (let i = 0; i < arr.length; i++) {

                    let strings = arr[i].split(/<br\/>|<br>/)
                    for (const str of strings) {
                        newArr.push(str)
                    }
                }
                outputs.push(newArr)
            }
            return outputs
        }
        let filteredInputs = filterHTML(inputs)
        let outputs = []
        for (const arr of filteredInputs) {
            if (!Array.isArray(arr)) {
                throw("inputs must be an array of arrays.")
            }
            let newArr = []
            let tags = []
            let openTargetTag = ""
            if (arr.filter(function (str) {
                return (str.indexOf('</') >= 0) //check if tags exist in arr else pass arr through as is
            }).length > 0) {
                for (const str of arr) {
                    //filter each string
                    let inTag = false
                    let closeTagStart = 0
                    let closeTagEnd = 0
                    let curTag = ""
                    if (tags.length > 0) {
                        curTag = tags.pop()
                    }
                    let openTag = false
                    let textContent = ""
                    for (let i = 0; i < str.length; i ++) {
                        switch (str[i]) {
                            case '<':
                                inTag = true
                                openTag = (str[i+1] != `/`) //true if opening tag, false if closing tag
                                if (openTag) {
                                    curTag = ""
                                } else {
                                    closeTagStart = i + 2
                                }


                                break
                            case '>':
                                if (openTag) {
                                    if (curTag.length) {
                                        let isTargetTag = (targetTags.indexOf(curTag.split(" ")[0]) > -1)
                                        if (isTargetTag) {
                                            openTargetTag = curTag
                                        }
                                        tags.push(curTag)
                                    }
                                } else {
                                    //check to see if a targetTag has closed
                                    closeTagEnd = i
                                    let closedTag = str.substring(closeTagStart, closeTagEnd)
                                    if (closedTag == openTargetTag.split(' ')[0]) {
                                        if (textContent.length > 0) {
                                            newArr.push(textContent)//add current textContent to newArr
                                            textContent = "" //reset current textContent
                                        }
                                        openTargetTag = ""
                                    }

                                    //check for parent tags already started
                                    tags.pop()
                                    if (tags.length > 0) {
                                        curTag = tags[tags.length - 1]
                                    } else {
                                        curTag = ""
                                    }
                                }
                                openTag = false
                                inTag = false
                                break
                            default:
                                //in textContent
                                if (!inTag) {

                                    if (excludeOtherTags) {
                                        if (openTargetTag != "") {
                                            textContent += str[i] //add char to textContent
                                        }
                                    } else {
                                        textContent += str[i] //add char to textContent
                                    }
                                } else {
                                    if (openTag) {
                                        curTag += str[i] //add char to curTag
                                    }
                                }
                                break
                        }

                    }
                    if (textContent.length > 0) {
                        newArr.push(textContent) // catch any text content at the end of the original string (outside of tags)
                    }
                }
                if (newArr.length > 0) {
                    outputs.push(newArr) // push filtered strings to outputs
                }
            } else {
                if (arr.length > 0) {
                    outputs.push(arr)
                }
            }
        }

        return outputs
    }

    /**
     * Given an array or arrays and an array of strings or chars, returns data having stripped the strings or chars from the data. (e.g. '\t' to strip tabs from textContent)
     * @param inputs An array of n arrays.
     * @param words An array containing the strings or chars to check against
     * @returns {Array} An array of arrays, with the strings or chars removed.
     */
    static stripWords(inputs, words) {
        words.push('  ')
        let outputs = []
        for (const row of inputs) {
            let nRow = []
            for (const str of row) {
                let stripped = str
                while (stripped.match(new RegExp(words.join("|")))) {
                    for (const word of words) {
                        let regx = new RegExp(word)
                        stripped = stripped.replace(word, ' ')
                    }
                }
                nRow.push(stripped)
            }
            outputs.push(nRow)
        }

        return outputs
    }

    static stripHTML(inputs) {
        let data = inputs
        for (let a in data) {
            for (let b in data[a]) {
                let text = document.createElement("textarea")
                text.innerHTML = data[a][b].replace(/<(?:.|\n)*?>/gm, '')
                data[a][b] = text.value.trim()
            }
        }

        return data
    }

    static splitName(inputs, fields, column) {
        let result = []
        if (/^((([A-Za-z](,( )*?)?)?)*[A-Za-z])*$|^((([0-9](,( )*?)?)?)*[0-9])*$/.test(column)){
            let index = AxiomApiHelper.colString2indexArray(column)[0]
            let data = inputs
            
            for (let item of data) {
                if (item == undefined || item == null || item.length == 0) {
                    //item empty and so will be skipped
                } else {
                    let row = JSON.parse(JSON.stringify(item))
                    let r = []
                    let count = 0
                    while (count < index && row.length > 0) {
                        r.push(row.shift())
                        count ++
                    }
                    let split = AxiomApiUtilities.expandName(row.shift(), fields.split(','))
                    if (split !== undefined && split.join('').length > 0) {
                        r = [].concat(r, split)
                        while (row.length > 0) {
                            r.push(row.shift())
                        }
                        result.push(r)
                    }
                }
            }
            let trim = AxiomApiHelper.transpose(result)
            trim = trim.filter(c => {
                for (const r of c) {
                    if (c.length > 0) {
                        return true
                    }
                }
                return false
            })
            result = AxiomApiHelper.transpose(trim)
            return result
        } else {
            callabck({error: "Please provide columns in correct format e.g. 1,2,3 or A,B,C"})
        }
    }

    static checkCondition(data, words, mode, exact) {
        if (!Array.isArray(data)) {
            return false
        }
        if (!data.length) {
            return false
        }
        if (!Array.isArray(data[0])) {
            return false
        }
        words = words.replace(/&nbsp;/g, '')
        const wordArray = words.split(',')
        // A blank word array will return true if the data is also not blank.
        if (wordArray.length === 0 && data.length > 0) {
            return true
        }
        let target = 1
        if (mode === 'all') {
            target = wordArray.length
        }
        let found = []
        let rowString = ''
        for (let row of data) {
            for (let j = 0; j < row.length; j++) {
                rowString += row[j] + ' '
            }
            for (let word of wordArray) {
                let tword = word.trim()
                if ((!exact && rowString.match(new RegExp(tword, 'gi'))) || (exact && rowString.match(new RegExp(`\\b${tword}\\b`, 'gi')))) {
                    found.push(word)
                }
            }
            let resultCount = wordArray.filter(item => found.indexOf(item) !== -1).length
            if (resultCount >= target) {
                return true
            }
        }
        return false
    }

    static findRowMatch(inputs, word, cols, searchmode, exact, callback) {
        let setup = AxiomApiFilters._wordFilterSetup(inputs, word, cols)
        AxiomApiFilters._findRowMatch(inputs, setup.words, setup.indices, searchmode, exact, callback)
    }

    static _findRowMatch(inputs, words, indices, searchmode, exact, callback) {
        const emptyWords = words.every(element => !element || (element && !element.trim()))

        if (emptyWords) {
            callback({error: "No values have been specified to search on"})
            return
        }

        const all = (searchmode === 'all')
        let i = 0

        while (i < inputs.length) {
            let row = inputs[i]

            for (let j = 0; j < row.length; j++) {
                let anyMatch = false
                let allMatch = true

                if (indices.length === 0 || (indices.length > 0 && indices.includes(j))) {
                    for (let word of words) {
                        // Escape special characters that would mash up the regex expression
                        word = word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

                        let exp = (exact) ? new RegExp(`^${word}$`, 'gi') : new RegExp(word, 'gi')

                        if (row[j].match(exp)) {
                            anyMatch = true
                        }
                        else {
                            allMatch = false
                        }
                    }
                }

                if ((all && allMatch) || (!all && anyMatch)) {
                    let foundRow = i + 1
                    callback([[foundRow.toString()]])
                    return
                }
            }

            i++
        }

        callback([[]])
    }
}
