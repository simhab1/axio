import _ from 'lodash'
import {AxiomApiHelper} from "../axiomapi/AxiomApiHelper"

/**
 * Set of utility functions for manipulating data.
 */
export class AxiomApiUtilities {
    /**
     * Convert data to specific format.
     * @param data Data to be formatted.
     * @param format Name of the format to convert the data into. "string"|"array1D"|"array2D"
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiUtilities.formatData(data, "string", (data) => {console.log(data)})
     */

    static formatData(data, format, callback) {
        let result
        const DATA_FORMATS = [
            "string",
            "array1D",
            "array2D",
            "table",
            "array2Ddiff"
        ]
        if (DATA_FORMATS.indexOf(format) < 0) {
            throw ("Invalid target format provided!")
        }
        const conversions = {
           "string-array1D": (s_data) => {let result = [s_data]; return result;},
           "string-array2D": (s_data) => {let result = [[s_data]]; return result;},
           "string-table" : (s_data) => {let result = conversions['string-array2D'](s_data); return JSON.parse(JSON.stringify(result).replace(/undefined|null/g, '\"\"'));},
           "array1D-string": (a1_data) => {let result = a1_data[0]; return String(result);},
           "array1D-array2D": (a1_data) => {let result = [a1_data]; return result;},
           "array1D-table": (a1_data) => {let result = conversions['array1D-array2D'](a1_data); return JSON.parse(JSON.stringify(result).replace(/undefined|null/g, '\"\"'));},
           "array2D-string": (a2_data) => {let result = a2_data[0][0]; return String(result);},
           "array2D-array1D": (a2_data) => {let result = a2_data.flat(); return result;},
           "array2D-table": (a2_data) => {
            let result = [];
                for (let row of a2_data) {
                    let newRow = [];
                    for (let cell of row) { 
                        if (cell != undefined && cell != null) {
                            newRow.push(cell)
                        } else {
                            newRow.push('')
                        }
                    }
                    result.push(newRow)
                }
                return result;
            },
            "array1D-array2Ddiff": data => AxiomApiHelper.transpose([data]),
            "array2D-array2Ddiff": data => data,
            "string-array2Ddiff": data => [[data]]
        }

        let currentFormat = this.getDataFormat(data)
        if (DATA_FORMATS.indexOf(currentFormat) < 0) {
            data = JSON.stringify(data)
            currentFormat = this.getDataFormat(data)
        }

        // If the data formats are indentical, we don't need to do anything! Hooray!
        if (currentFormat === format) {
            callback(JSON.parse(JSON.stringify(data)))
            return
        }

        if (`${currentFormat}-${format}` in conversions) {
            result = conversions[`${currentFormat}-${format}`](data)
        } else {
            throw (`Conversions between "${currentFormat}" and "${format}" are not currently supported!"`)
        }
        
        callback(result)
    }

    static getDataFormat(data) {
        let dataType = typeof data
        const catagories = {
            "undefined": () => {return "undefined"},
            "boolean": () => {return "boolean"},
            "number": () => {return "number"},
            "string": () => {return "string"},
            "symbol": () => {return "symbol"},
            "function": () => {return "function"},
            "object": () => {
                if (data === null) {
                    return "null"
                } else if (Array.isArray(data)) {
                    let depth = this.getArrayDepth(data)
                    return `array${depth}D`
                } else {
                    return "object"
                }
            }
        }
        return catagories[dataType]()
    }

    static getArrayDepth(data) {
        let done = false
        let depth = 0
        let test = data

        while (!done) {
            if (Array.isArray(test)) {
                test = test[0]
                depth ++
            } else {
                done = true
            }
        }

        return depth
    }
    
    static preFormat(input, data, format, callback) {
        AxiomApiUtilities.formatData(data, format, (formattedData) => {
            AxiomApiUtilities.formatData(input, format, (formattedInput) => {
                let formatted = (formattedData && formattedData[0] && formattedData[0][0] && formattedData[0][0].length > 0) ? formattedData : formattedInput
                callback(formatted)
            })
        })
    }

    static decodeHtml(html) {
        var txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }

    static checkCodeForMethod(code, methodName) {
        let lines = code.split('\n')
        let multiCommented = false
        let found = []
        function itemWithinSpan(foundAt, spanStart, spanEnd) {
            return ((foundAt > spanStart) && (spanEnd == -1 || foundAt < spanEnd))
        }
        for (let line of lines) {
            // get index values
            let multiStart = line.indexOf("/*")
            let multiEnd = line.indexOf("*/")
            let foundAt = line.indexOf(`${methodName}(`)
            let singleComment = line.indexOf("//")

            if (multiStart > -1) {
                multiCommented = true
            }

            if (foundAt > -1) {
                let props = []
                //check if it was found in a multiline comment
                if (multiCommented) {
                    if(itemWithinSpan(foundAt, multiStart, multiEnd)) {
                        props.push("multiCommented")
                    }
                }
                if (singleComment > -1) {
                    if (itemWithinSpan(foundAt, singleComment, line.length)) {
                        props.push("singleCommented")
                    }
                }

                if (props.length < 1) {
                    found.push(`${lines.indexOf(line)}-${foundAt}`)
                }
            }

            if (multiEnd > -1) {
                multiCommented = false
            }
        }
        return found
    }

    static convertListToArray(data) {
        let arrayOfList = data.split("<br>")
        const arrLength = arrayOfList.length
        for (var i = 0; i < arrLength; i++) {
            let text = document.createElement("textarea")
            text.innerHTML = arrayOfList[i]
            arrayOfList[i] = text.value.trim()
        }
        return arrayOfList
    }

    static clone(item) {
        return _.cloneDeep(item)
    }

    static expandName(fullName, parts = ['firstName', 'lastName']) {
        function jclone(item) {
            if (item != null && item != undefined) {
                return JSON.parse(JSON.stringify(item))
            }
        }
    
        function splitName(fullName) {
            let titles = ["Abbot","Admiral","Adm.","Ambassador","Amb.","Baron","Baroness","Brnss.","Bishop","Brigadier General","Brig. Gen.","BG","Brother","Br.","Captain (Army)","Cpt.","Captain (Navy)","Capt.","Chancellor","Chan.","Chaplain","Chapln.","Chief Petty Officer","CPO","Commander","Cmdr.","CDR","Cdr. (U.K.)","Colonel","Col.","Colonel (Retired)","Col. (Ret.)","Corporal","Cpl.","Count","Countess","Cntss.", "Dame", "Dean","Dr.","Drs.","Dr. and Mrs.","Duke","Ensign","Ens.","Estate of","Father","Fr.","Friar","Fr.","Frau","General","Gen.","Governor","Gov.","Judge","Justice","Lord","Lieutenant","Lt.","2nd Lieutenant (Army)","2Lt.","2nd Lieutenant (Marine/A.F.)","2dLt.","Lieutenant Commander","Lt. Cmdr.","Ltc.","Lieutenant Colonel","Lt. Col.","Ltc.","Lieutenant General","Lt. Gen.","Ltg.","Lieutenant junior grade","Lt. j.g.","Mademoiselle","Mlle.","Major","Maj.","Master","Master Sergeant","Master Sgt.","Miss","Madame","Mme.","Midshipman","MIDN","Monsieur","M.","Monsignor","Msgr.","Mr.", "Mr. & Dr.","Mr. & Mrs.","Mrs.","Ms.","Mx.","President","Pres.","Princess","Professor","Prof.","Prof. & Mrs.","Rabbi","Rear Admiral","R.Adm.","Representative","Rep.","Reverend","Rev.","Reverends","Revs.","Right Reverend","Rt.Rev.","Sergeant","Sgt.","Senator","Sen.","Senor","Sr.","Senora","Sra.","Senorita","Srta.","Sheikh","Sir","Sister","Sr.","Staff Sergeant","S. Sgt.","The Honorable","The Hon.","The Venerable","Trust(ees)of","Vice Admiral","V.Adm."]
            let title, firstName, otherNames, lastName, initials // TODO: Initials
                
            if (/\p{L}/u.test(fullName)) {
                let components = jclone(fullName).split(' ')
    
                let reversed = /\p{L}*,/gu.test(fullName)
    
                if (reversed) {
                    lastName = components.shift().replace(',', '')
                    firstName = components.shift()
                    otherNames = jclone(components).join(' ')
                } else {
                    let found = jclone(titles).filter(t => {
                        return (components.includes(t) || components.includes(t + '.') || components.includes(t.replace('.', '')))
                    })
                    if (found && found.length > 0) {
                        title = found[0]
                        components = components.filter(c => {
                            return !(new RegExp(c, 'g').test(titles.join('.')))
                        })
                        lastName = components.pop()
                    }
                    
                    if (components.length > 0) {
                        firstName = components.shift()
                    }
                    if (components.length > 0 && lastName == undefined) {
                        lastName = components.pop()
                    }

                    otherNames = jclone(components).filter(c => {
                        return /\p{L}/u.test(c) && c.length > 1
                    })
                    otherNames = (otherNames.length > 0) ? otherNames.join(' ') : undefined
                    
                }
            }

            return {title, firstName, otherNames, lastName, initials}
        }
        if (fullName == undefined || fullName == null || fullName.length == 0) {
            return undefined
        }
        let components = splitName(fullName)
        let result = []
        for (let part of parts) {
            let res = (components[part.trim()]) ? components[part.trim()] : ''
            result.push(res)
        }
        return result
    }

    static getURLs(links) {
        if (typeof links != "string") {
            links = links.join('<br>')
        }
        links = links.replace(' ', '')
        links = links.replace(/&amp;/g, "&")
        links = links.split(/[\n\r\t\s]|<br>|,(?=http)/)

        links = links.map(url => {
            if (url.match(/^(http|https|file):/) === null) {
                url = `http://${url}`
            }

            return url
        }).filter(url => {
            let testURL

            try {
                testURL = new URL(url)
            } catch (_) {
                return false
            }

            return (testURL.protocol === 'http:' || testURL.protocol === 'https:' || testURL.protocol === 'file:')
        })

        return links
    }
    
    static arrayToHTML (message){
        const inputFormat = this.getDataFormat(message)
        switch (inputFormat) {
            case 'array2D':
                let table = '<table class="dmTable">'
                table += '<tr><th class="index"></th>'
                for (let col in message[0]) {
                    table += `<th>${AxiomApiHelper.getColLetter(col)}</th>`
                }
                table += '</tr>'
                for (const tr of message) {
                    table += '<tr>'
                    table += `<th class="index">${message.indexOf(tr) + 1}</th>`
                    for (const td of tr) {
                        table += `<td>${td}</td>`
                    }
                    table += '</tr>'
                }
                table += '</table>'
                message = table
                break
            default:
                message = JSON.stringify(message)
                break
        }

        return message
    }

    static drawTable(diffTable) {
        let table = '<table class="diffTable">'
        table += diffTable.length ? `<tr><th colspan='100'>Rows changed</th></tr>` : `<tr><th colspan='100'>No changes available. </th></tr>`
        for (const tr of diffTable) {
            let bg
            if (tr.type !== 'Unchanged') {
                if (tr.type === 'Changed') {
                    bg = 'edit'
                } else if (tr.type === 'Removed') {
                    bg = 'delete'
                } else if (tr.type === 'Added') {
                    bg = 'new'
                }
                table += `<tr class="${bg}">`
                tr.item.forEach(th => {
                    table += `<td>${th}</td>`
                })
                table += '</tr>'
            }
        }
        table += '</table>'
        table += `
        <ul class="instruction">
            <li style='color:#9FA8DA'>Edited</li>
            <li style='color:#FFAB91'>Deleted</li>
            <li style='color:#4DD0E1'>Added</li>
        </ul>
        `

        return table;
    }
}

