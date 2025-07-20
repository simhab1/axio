import {AxiomApiUtilities} from "./AxiomApiUtilities"
import {AxiomApiHelper} from "./AxiomApiHelper"
import {CurrentUserData} from "../../classes/models/CurrentUserData"
import {apiProvider} from "../../classes/services/api/ApiProvider"

/**
 * Integrate with third party services.
 */
export class AxiomApiIntegrations {

    /**
     * Get the spreadsheet_id of a google sheet from the provided url
     * @param url The url of the google sheet
     */
    static getSpreadsheetIdFromUrl(url, callback) {
        AxiomApiUtilities.formatData(url, 'string', formatted_url => {
            let sections = formatted_url.split('/')

            if (!sections.slice(-1)[0].includes('edit')) {
                sections.push('edit')
            }

            let spreadsheet_id = (sections.length > 1) ? sections[sections.length -2] : sections[0]
            callback(spreadsheet_id)
        })
    }

    /**
     * Create a Google spreadsheet.
     * @param params Passed options.
     * @param params.name Name to give the spreadsheet once created.
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiIntegrations.createGoogleSheet({name: "MyGoogleSheetName"},(data) => {console.log(data)})
     */
    static async createGoogleSheet(params, callback) {
        const user = new CurrentUserData()
        await user.load()
        apiProvider.sendGqlMutation(
            `mutation Create($name: String!, $user_id: Int!) {  
                CreateGoogleSheet(
                    name: $name,
                    user_id: $user_id
                ) {    
                    id,
                    url,
                    sheet_data
                }
            }`,
            {name: params.name, user_id: user.id}
        ).then(res2 => {
            callback(res2.data.CreateGoogleSheet)
        }, reject => {
            const msg = (reject) ? reject.graphQLErrors[0].message : "No response from google sheets api"
            callback({error: `Failed to create google sheet\n ${msg}`})
        })
    }

    /**
     * Create a sheet in google spreadsheet.
     * @param params Passed options.
     * @param params.title Name to give the spreadsheet once created.
     * @param params.spreadsheet_id ID of the spreadsheet .
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiIntegrations.createSheetInGoogleSheet({spreadsheet_id:"8515151151erfh8-eref-x" , title: "SALES REPORT" }, (data) => {console.log(data) })
     */
    static createSheetInGoogleSheet(params, callback) {
        this.getSpreadsheetIdFromUrl(params.spreadsheet_id, async spreadsheet_id => {
            apiProvider.sendGqlMutation(
                `mutation CreateWorkSheet($spreadsheet_id: String!, $title: String!, $rename: Boolean!) {  
                    CreateWorkSheet(
                        spreadsheet_id: $spreadsheet_id,
                        title: $title,
                        rename: $rename
                    ) {    
                        id
                    }
                }`,
                {spreadsheet_id: spreadsheet_id, title: params.title, rename: params.rename}
            ).then(res2 => {
                callback(res2.data.CreateWorkSheet)
            }, reject => {
                const msg = (!reject) ?  "No response from google sheets api" : reject.graphQLErrors[0].message
                callback({error: `Failed to create new sheet in google sheet: \n ${msg}`})
            })
        })
    }

    /**
     * Append data to an existing Google spreadsheet.
     * @param params Passed options.
     * @param params.spreadsheet_id: The id of the spreadsheet.
     * @param params.data: data to write, as an array of arrays.
     * @param params.offset: number of rows skipped between existing and new data
     * @param params.column_offset: skip this number of columns (avoid overwrites)
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiIntegration.appendGoogleSheet({spreadsheet_id: "1MnwYThhgBT6SkfqC6eTMFVrlKXuLGQeFj-oQ6LyQK7U", data: [["A1", "A2", "A3"],["B1", "B2", "B3"]], start_cell: "A5"},(data) => {console.log(data)})
     */
    static appendGoogleSheet(params, callback) {
        this.getSpreadsheetIdFromUrl(params.spreadsheet_id, async spreadsheet_id => {
            params.range = (params.sheet_name) ? params.sheet_name + "!A1:Z" : "A1:Z"
            this.readGoogleSheet(params, sheet_data => {
                if (sheet_data.error) {
                    callback({error: sheet_data.error})
                } else {
                    let rowOffset = 0
                    let columnOffset = 0

                    if (!params.start_cell || params.start_cell === undefined) {
                        rowOffset = (sheet_data && sheet_data['values'] != undefined) ? sheet_data['values'].length : 0
                    } else {
                        rowOffset = parseInt(params.start_cell.replace(/\D/g, '')) - 1
                        const startCol = params.start_cell.toUpperCase().replace(/[^A-Z]/g, '')

                        columnOffset = AxiomApiHelper.getColIndex(startCol)
                    }

                    this.updateGoogleSheet({spreadsheet_id: spreadsheet_id, data: params.data, offset: rowOffset, column_offset: columnOffset, sheet_name: params.sheet_name}, res => {
                        callback(res)
                    })
                }
            })
        })
    }

    static overwriteGoogleSheet(params, callback) {
        this.getSpreadsheetIdFromUrl(params.spreadsheet_id, async spreadsheet_id => {
            params.spreadsheet_id = spreadsheet_id
            params.range = (params.sheet_name) ? params.sheet_name + "!A1:Z" : "A1:Z"
            this.readGoogleSheet(params, sheet_data => {
                if (sheet_data.error) {
                    callback({error: sheet_data.error})
                } else {
                    params['range'] = (sheet_data) ? sheet_data['range'] : 'A1'
                    this.clearGoogleSheet(params, cleared => {
                        this.updateGoogleSheet(params, res => {
                            callback(res)
                        })
                    })
                }
            })
        })
    }

    /**
     * Add data to a Google spreadsheet.
     * @param params Passed options.
     * @param params.spreadsheet_id: The id of the spreadsheet.
     * @param params.data: data to write, as an array of arrays.
     * @param params.offset: skip this number of rows (avoid overwrites)
     * @param params.column_offset: skip this number of columns (avoid overwrites)
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiIntegration.updateGoogleSheet({spreadsheet_id: "1MnwYThhgBT6SkfqC6eTMFVrlKXuLGQeFj-oQ6LyQK7U", data: [["A1", "A2", "A3"],["B1", "B2", "B3"]], offset: 0, column_offset: 0},(data) => {console.log(data)})
     */
    static updateGoogleSheet(params, callback) {
        if (params.data) {
            let rangeStr = ''
            let rowStr = ''

            const rowOffset = (!params.offset) ? 0 : parseInt(params.offset)
            const columnOffset = (!params.column_offset) ? 0 : parseInt(params.column_offset)

            const batchSize = 5000
            let batchNum = Math.ceil(params.data.length / batchSize)
            let row = 0;
            let thereWasAnError = false
            for (let i = 0; i < batchNum; i++) {
                rowStr = ''
                rangeStr = ''
                for (let j = 0; j < batchSize; j++) {
                    if (row < params.data.length) {
                        const rowNum = row + rowOffset

                        for (let col = 0; col < params.data[row].length; col ++) {
                            let colNum = col + columnOffset
                            const colLetter = AxiomApiHelper.getColLetter(colNum)
                            rangeStr += colLetter + (rowNum+1).toString() + "||"
                            let cellValue = (params.data[row][col].length > 50000) ? params.data[row][col].slice(0, 50000) : params.data[row][col]
                            // We have to remove double pipes from results; this will, rarely, cause a problem where they stranglely disappear.
                            // It can be fixed, if needed.
                            if (cellValue.replace) {
                                cellValue = cellValue.replace(/\|\|/g, '')
                            } else {
                                cellValue = ""
                            }
                            rowStr += cellValue + "||"
                        }
                    }
                    row++
                }
                ((rows, ranges, iterator) => {
                    this.getSpreadsheetIdFromUrl(params.spreadsheet_id, async spreadsheet_id => {
                        const user = new CurrentUserData()
                        await user.load()
                        apiProvider.sendGqlMutation(
                            `mutation addData($spreadsheet_id: String!, $range: String!, $row: String!, $sheet: String, $user_id: Int!) {
                                CreateRaw(
                                    spreadsheet_id: $spreadsheet_id, 
                                    range: $range, 
                                    row: $row, 
                                    sheet: $sheet,
                                    user_id: $user_id
                                ) {
                                    id
                                }
                            }`,
                            {
                                spreadsheet_id,
                                range: ranges,
                                row: rows,
                                sheet: params.sheet_name,
                                user_id: user.id
                            }
                        ).then(res => {
                           // If this is the last loop, return
                           if (iterator === batchNum - 1) {
                                callback()
                           }
                        }, reject => {
                            this.googleSheetError(reject, params, callback)
                            thereWasAnError = true
                            return
                        })
                    })
                })(rowStr, rangeStr, i)
                // Quit if one of the batches failed
                if (thereWasAnError) {
                    break
                }
            }
        } else {
            callback({error: "No data received to write to Google sheet"})
        }
    }

    /**
     * read data from a Google spreadsheet.
     * @param params Passed options.
     * @param params.spreadsheet_id: The id of the spreadsheet.
     * @param params.range: The range of cells to read from e.g. "Sheet1!A1:Z".
     * @param params.row: Specify in order to get the nth single row from range
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiIntegration.readGoogleSheet({spreadsheet_id: "1MnwYThhgBT6SkfqC6eTMFVrlKXuLGQeFj-oQ6LyQK7U", range: "Sheet1!A1:Z", row: 2},(data) => {console.log(data)})
     */
    static readGoogleSheet(params, callback) {
        this.getSpreadsheetIdFromUrl(params.spreadsheet_id, async spreadsheet_id => {
            if (!spreadsheet_id) {
                callback()
            } else {
                const user = new CurrentUserData()
                await user.load()
                apiProvider.sendGqlQuery(
                    `query C($spreadsheet_id: String!, $range: String!, $row: Int!, $user_id: Int!) {  
                        google_sheets(
                            id: $spreadsheet_id, 
                            range: $range, 
                            row: $row, 
                            user_id: $user_id
                        ) {    
                            sheet_data  
                        }
                    }`,
                    {
                        spreadsheet_id,
                        range: (params.range) ? params.range : "A1:Z",
                        row: (params.row) ? params.row : -1,
                        user_id: user.id
                    }
                ).then(res => {
                    let values = JSON.parse(res.data.google_sheets.sheet_data)
                    for (let v in values.values) {
                        values.values[v] = values.values[v].map(item => {                    
                            return item.trim()
                        })
                    }
                    callback(values)
                }, reject => {
                    console.error(reject)
                    this.googleSheetError(reject, params, callback)
                })
            }
        })
    }

    /**
     * sorts data within a Google spreadsheet.
     * @param params Passed options.
     * @param params.spreadsheet_id: The id of the spreadsheet.
     * @param params.range The range of cells to to be sorted e.g. "Sheet1!A1:Z".
     * @param params.columns An array of strings representing each column to sort by e.g. ["A", "C"]
     * @param params.sort_orders An array of strings specifying a sort order for each column provided e.g. ["ASCENDING", "DESCENDING"]
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiIntegration.sortGoogleSheet({spreadsheet_id: "1MnwYThhgBT6SkfqC6eTMFVrlKXuLGQeFj-oQ6LyQK7U", range: "Sheet1!A1:Z", columns: ["A"], sort_orders: ["ASCENDING"]},(data) => {console.log(data)})
     */
    static sortGoogleSheet(params, callback) {
        this.getSpreadsheetIdFromUrl(params.spreadsheet_id, async spreadsheet_id => {
            const user = new CurrentUserData()
            await user.load()
            apiProvider.sendGqlMutation(
                `mutation sort($spreadsheet_id: String!, $range: [String!], $columns: [String!], $sort_orders: [String!],  $user_id: Int!) {
                    SortByColumn(spreadsheet_id: $spreadsheet_id, range: $range, columns: $columns, sort_orders: $sort_orders, user_id: $user_id) {
                            sheet_data
                    }
                }`,
                {spreadsheet_id: spreadsheet_id, range: (params.range) ? params.range : "" , columns: (params.columns) ? params.columns : ['A'], sort_orders: (params.sort_orders) ? params.sort_orders : ["ASCENDING"], user_id: res}
            ).then(res => {
                callback(res)
            }, reject => {
                const msg = (!reject) ?  "No response from google sheets api" : reject.graphQLErrors[0].message
                callback({error: "Failed to sort google sheet:\n"+msg})
            })
        })
    }

    /**
     * Change the colour of a google sheet cell.
     * @param params.spreadsheet_id: The id of the spreadsheet.
     * @param params.range The range of cells to to be re-coloured e.g. "Sheet1!A1:Z".
     * @param params.background_colour The background colour to use as a hex value, e.g. '#ffffff'. Defaults to white.
     * @param params.foreground_colour The forground (text) colour to use as a hex value, e.g. #000000. Defaults to black.
     * @param callback Callback function, triggered once the task is complete.
     */
    static setGoogleSheetColour(params, callback) {
        this.getSpreadsheetIdFromUrl(params.spreadsheet_id, async spreadsheet_id => {
            const user = new CurrentUserData()
            await user.load()
            apiProvider.sendGqlMutation(
                `mutation colour($spreadsheet_id: String!, $range: [String!], $background_colour: String!, $foreground_colour: String!, $user_id: Int!) {
                    SetSheetColour(spreadsheet_id: $spreadsheet_id, range: $range, background_colour: $background_colour, foreground_colour: $foreground_colour, user_id: $user_id) {
                            sheet_data
                    }
                }`,
                {spreadsheet_id: spreadsheet_id, range: (params.range) ? params.range : "", background_colour: (params.background_colour) ? params.background_colour : "#ffffff", foreground_colour: (params.foreground_colour) ? params.foreground_colour : "#000000", user_id: res}
            ).then(res => {
                callback(res)
            }, reject => {
                const msg = (!reject) ?  "No response from google sheets api" : reject.graphQLErrors[0].message
                callback({error: "Error writing to google sheet:\n"+msg})
            })
        })
    }

    /**
     * clears all data from a Google spreadsheet.
     * @param params Passed options.
     * @param params.spreadsheet_id: The id of the spreadsheet.
     * @param params.sheet: The title of the sheet to be cleared.
     * @param callback Callback function, triggered once the task is complete.
     * @example AxiomApiIntegration.clearGoogleSheet({spreadsheet_id: "1MnwYThhgBT6SkfqC6eTMFVrlKXuLGQeFj-oQ6LyQK7U", sheet: "Sheet1"},(data) => {console.log(data)})
     */
    static async clearGoogleSheet(params, callback) {
        const user = new CurrentUserData()
        await user.load()
        apiProvider.sendGqlMutation(
            `mutation clear($spreadsheet_id: String!,$sheet: String!, $user_id: Int!) {
                ClearSheet(spreadsheet_id: $spreadsheet_id, sheet: $sheet, user_id: $user_id) {
                    sheet_data
                }
            }`,
            {spreadsheet_id: params.spreadsheet_id, sheet: (params.sheet) ? params.sheet : (params.sheet_name) ? params.sheet_name : "", user_id: user.id}
        ).then(res2 => {
            callback(res2)
        }, reject => {
            const msg = (!reject) ?  "No response from google sheets api" : reject.graphQLErrors[0].message
            callback({error: "Error clearing google sheet:\n"+msg})
        })
    }

    /**
     * Delete rows from google sheet
     * @param {*} params 
     * @param {*} callback 
     */
    static async deleteRowsFromGoogleSheet(params, callback) {
        this.getSpreadsheetIdFromUrl(params.spreadsheet_id, spreadsheet_id => {
            apiProvider.sendGqlMutation(
                `mutation deleteRows($spreadsheet_id: String!, $start: Int!, $end: Int!, $sheet: String!) {
                    DeleteRows(spreadsheet_id: $spreadsheet_id, start: $start, end: $end, sheet: $sheet) {
                        sheet_data
                    }
                }`,
                {spreadsheet_id: spreadsheet_id, start: params.start, end: params.end, sheet: params.sheet}
            ).then(res => {
                callback(res)
            }, reject => {
                console.error(reject)
                this.googleSheetError(reject, params, callback)
            })
        })
    }

    /**
     * Run a generic google search.
     * @param params
     * @param callback
     */
    static google(params, callback) {
        apiProvider.sendGqlQuery(
            `query search($targets: String!, $sources: String!) {
                google_search(targets: $targets, sources: $sources, custom_search_engine_id: "13251396980407527310:a3tmw-jdsum") {
                    response
                }
            }`, {}
        ).then(res => {
            callback(res)
        })
    }

    static sendEmail(params, callback) {
        let to = params.email_addresses
        
        if (typeof params.email_addresses === 'string' || params.email_addresses instanceof String) {
            to = params.email_addresses.split('<br>').map(email => email.replace(/&nbsp;/g,'').trim()).filter(email => email !== "").map(email => email.split(','))
            to = flatten(to)
        } else if (Array.isArray(params.email_addresses)) {
            to = flatten(to)
            to = to.filter(email => email !== '')
        }
        
        let body = params.body
        if (Array.isArray(params.body)) {
            body = params.body.join(' ')
        }
        apiProvider.sendGqlQuery(
            `query xy($email: [String], $message: String, $subject: String) {
                emailsender(email: $email, message: $message, subject: $subject) {
                    response
                }
            }`,
            {
                email: to,
                subject: (params.subject) ? params.subject : "Email subject",
                message: (body) ? body : "Email body"
            }
        ).then(res => {
            callback(res)
        }, reject => {
            const msg = (!reject) ?  "No response from email api" : reject.graphQLErrors[0].message
            callback({error: "Failed to send email - " + msg})
        })
    }

    static async sendSms(params, callback) {
        let sendTo = params.phone_numbers

        if (typeof params.phone_numbers === 'string' || params.phone_numbers instanceof String) {
            sendTo.replace(/\s/g,'')
            sendTo = sendTo.replace('<br>', ",").split(",")
        } else if (Array.isArray(params.phone_numbers)) {
            sendTo = flatten(params.phone_numbers)
            sendTo = sendTo[0].replace('<br>', ",").split(",")
        }

        let message = (params.body) ? params.body : "Axiom"
        message = message.replace(/<br\s*[\/]?>/gi, "\n")

        apiProvider.sendGqlQuery(
            `query sms($phoneno: [String],$message: String) {
                smssender(phoneno: $phoneno, subject: "Axiom", message: $message) {
                    response
                }
            }`,
            {
                phoneno: sendTo,
                message: message
            }
        ).then(res => {
            callback(res)
        }, reject => {
            let msg = (!reject) ? "No response from sms api" : reject.graphQLErrors[0].message
            msg = 'Error sending Sms \n' + msg;
            callback({error: msg})
        })
    }

    static googleSheetError(error, params, callback) {
        try {
            if (typeof error.graphQLErrors[0].message === 'string') {
                let err = JSON.parse(error.graphQLErrors[0].message)
                if (err.error.status) {
                    switch (err.error.status){
                        case 'PERMISSION_DENIED':
                            callback({ error: "You have insufficient permissions to access this Google sheet, you will need to share the sheet with the Google account that you have connected to your Axiom account."})
                            break
                        case 'NOT_FOUND':
                            callback({ error: "The sheet cannot be found. Please verify the URL and the name are valid." })
                            break
                        case 'INVALID_ARGUMENT':
                            callback({ error: "A sheet on the name you've provided seems missing or incorrect. Please verify!" })
                            break
                        default:
                            callback({ error: error.graphQLErrors[0].message })
                            break
                    }
                } else {
                    callback({ error: error.graphQLErrors[0].message })
                }
            } else {
                let err = JSON.parse(error.graphQLErrors[0].message).error
                if (err.message.toLowerCase().indexOf('unable to parse range') !== -1) {
                    if (params.range) {
                        callback({error: "Could not find the specified place in the Google sheet! Please check that sheet/range " + params.range + " exists."})
                    } else {
                        callback({error: "Could not find the specified place in the Google sheet! Please check that range A1:Z exists."})
                    }
                } else {
                    callback({error: "Error reading from Google sheet - " + err.message})
                }
            }
        } catch (e) {
            callback({error: "Error reading from Google sheet"})
        }
    }

    static async AxiomApiRestApi(params, callback) {
        apiProvider.sendGqlMutation(
            `mutation RestApi($url: String!, $type: String!, $data: String!) {
                RestApi(
                    url: $url,
                    type: $type,
                    data: $data
                ) {
                    response
                }
            }`,
            {
                url: params.url,
                type: params.type,
                data: params.data,
            }
        ).then(res => {
            callback(res.data.RestApi.response)
        }, reject => {
            const msg = (reject) ? reject.graphQLErrors[0].message : "No response from webhook"
            callback({error: `Trigger webhook error: ${msg}`})
        })
    }

    static readExcelSheet(params, callback) {
        AxiomApiUtilities.formatData(params.workbook, "string", async workbookdUrl => {
            apiProvider.sendGqlQuery(
                `query ReadExcelSheet($workbook_url: String!, $sheet_name: String!, $range: String!) {
                    ReadExcelSheet(workbook_url: $workbook_url, sheet_name: $sheet_name, range: $range) {
                        excel_sheet_data
                    }
                }`,
                {
                    workbook_url: workbookdUrl,
                    sheet_name: params.sheetName,
                    range: params.range
                }
            ).then(res => {
                let values = JSON.parse(res.data.ReadExcelSheet.excel_sheet_data)

                for (let v in values) {
                    values[v] = values[v].map(item => {
                        return item.trim()
                    })
                }

                callback(values)
            }, reject => {
                this.excelSheetError(reject, params, callback)
            })
        })
    }

    static excelSheetError(error, params, callback) {
        if (error.graphQLErrors && error.graphQLErrors[0].message) {
            let message = error.graphQLErrors[0].message.replace(/\/\n/g,"").replace(/\n/g,"")
            let errText = message.substring(message.indexOf('{"error":'))

            try {
                let err = JSON.parse(errText)

                switch (err.error.code) {
                    case 'InvalidAuthenticationToken':
                        callback({error: "Your Microsoft access token is invalid or has expired - please reconnect your Microsoft account to use this step."})
                        break
                    default:
                        callback({error: message}) 
                }
            } catch {
                callback({error: "Excel sheet error - " + message})
            }
        } else {
            callback({error: "Excel sheet error - " + JSON.stringify(error)})
        }
    }
}

function flatten(arr) {
    return arr.reduce(function (flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}
