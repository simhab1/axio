import {AxiomApiUtilities} from "./AxiomApiUtilities"
import appChecker from "../../classes/services/AppChecker"
import {DriverExecution} from "../../classes/services/DriverExecution"
import {AxiomApiBrowser} from "./AxiomApiBrowser"
import {TokenCompiler} from "../../classes/TokenCompiler"
import { AxiomApiHelper } from "./AxiomApiHelper"
import {CurrentUserData} from "../../classes/models/CurrentUserData"

/**
 * Create and launch a new automation instance.
 */
export class AxiomApiDriver {
    constructor(driverExecution = null, options = {
        headless: false,
        url: "",
        defaultViewport: null
    }, url = "", data, tooltiptime = 0) {

        if (process.env.CLOUD_ENV === "1") {
            options.defaultViewport = {width: 1920, height: 1080}
        }

        this.commands = []
        this.options = options

        if (url && typeof url == 'string' && url != '') {
            this.goto(url)
        }
        
        this.data = undefined
        if (data && data.length && data.length > 0) {
            this.data = data
        }
        this.tooltiptime = tooltiptime
        this.driverExecution = driverExecution
        // Workaround for old code which was using message passing; will cause some oddities with stopping
        // but should at least run.
        if (this.driverExecution === null) {
            console.warn("Forced creation of DriverExecution due to missing parameter")
            this.driverExecution = new DriverExecution()
        }
    }




    /**
     * Navigate to the given URL
     * @param url
     * @example
     * let driver = new AxiomApiDriver()
     * driver.goto("http://www.google.com")
     * driver.run()
     */
    goto(url, name='Navigate to Page') {
        this.commands.push({action: "goto", url, name})
        this.url = url;

    }

    /**
     * Closes the axiomai:// tab launched triggered when launching the desktop app
     */
    static closeAxiomTab() {
        chrome.tabs.query({active:true, currentWindow:true},function(tabs) {
            if(tabs[0].pendingUrl =='axiomai://run') {
                chrome.tabs.remove(tabs[0].id, function() { });
            }
        })
    }

    /**
     * Enter text into a form field
     * @param selector Selector of the text box to enter text to
     * @param text Text to enter
     */
    enterText(selector, text, delay = 0, name = 'Enter Text') {
        if (typeof text === 'string') {
            text = text.replace(/<br>/g, "\n")
        }
        // Fixing old axioms
        if (isNaN(delay)) {
            name = delay
            delay = 0
        }
        this.commands.push({action: "keydown", selector, value: text, name, delay})

    }

    /**
     * Click a page element
     * @param selector The selector of the element to click
     */
    click(selector, name='Click Here') {
        this.commands.push({action: "click", selector, name:name})

    }

    /**
     * Click a page element
     * @param selector The selector of the element to click
     */
    clickEngagementButton(selector, word, name = 'Click Engagement Button') {
        this.commands.push({ action: "click_engagement_button", selector, value: word, name: 'Click Here' })
    }

    /**
     * Hover a page element
     * @param selector The selector of the element to hover
     */
    hover(selector, name='Hover Here') {
        this.commands.push({action: "mouseover", selector, name:name})

    }

    /**
     * Reload the page and wait for page to finish loading
     */
    waitUntilLoaded() {
        this.commands.push({action: "wait_until_loaded"})
    }

    waitForPageChange() {
        this.commands.push({action: "wait", value: 1000})
        this.commands.push({action: "wait_for_page_change"})
    }

    /**
     * Press a key
     * @param key The key to press
     */
    keydown(key, name="Press Key") {
        this.keydownV300(key, undefined, '', name)
    }

    // NOTE: Unsupported with old engine.
    keydownV300(key, token, delimiter, name="Press Key") {
        if (key.length === 0 && token) {
            throw('Tokens in keypress not supported with the pre-2.5.0 engine. Please switch to using the v2.5.0 engine.')
        }
        this.commands.push({action: "keypress", value: key, name: name})
    }

    /**
     * Uploads a file into a file input field
     * @param selector The selector of the file input field
     * @param filePath The path of the file to upload (the path should be absolute path)
     */
    fileUpload(selector, filePath, name="Upload file") {
        this.commands.push({action: 'file_upload', selector: selector, value: filePath, name:name})
    }

    /**
     * Goes to the supplied login URL, enters the username, and presents the user with a form for the password
     * @param url
     * @param username
     * @param usernameSelector
     * @param passwordSelector
     */
    login(url, username, usernameSelector, passwordSelector, name="Login Here") {
        this.commands.push({
            action: 'login',
            url: url,
            selector: usernameSelector,
            value: username,
            toolTipSelector: 'input[type="password"]',
            toolTipText: 'Input your password now',
            wait: '30000',
            name: name
        })
    }

    /**
     * Displays a tooltip message on a targetted element for a specified amount of time as specified
     *
     * @param selector The selector of the target element on which the tooltip should be displayed upon
     * @param displayText The text to be displayed on the tooltip
     * @param displayTime The time to show the tooltip
     */
    displayTip(selector, displayText, displayTime) {
        this.commands.push({action: 'tooltip', toolTipSelector: selector, toolTipText: displayText, wait: displayTime})
    }

    /**
     * Click and drag an element to a different (target dragTo) area
     *
     * @param element The selector of the element which should be clicked and dragged
     * @param dragTo The target location of the element to be dragged to
     */
    clickAndDrag(element, dragTo, dragType, name="Click and Drag") {
        this.commands.push({action: 'click_and_drag', selector: element, value: dragTo, dragType, name:name})
    }

    /**
     * Pauses script execution for the specified amount of time
     * @param duration Time in milliseconds to pause for
     */
    wait(duration) {
        this.commands.push({action: "wait", value: duration})
    }


    getRndInteger(mins, maxs) {
        return Math.floor(Math.random() * (maxs - mins + 1)) + mins;
    }

    /**
     * Wait for a random amount of time.
     * @param min Time in milliseconds to pause for
     * @param max Time in milliseconds to pause for
     */
    randomWait(min, max) {
        let rndWait = 0
        if (parseInt(min) > parseInt(max)) {
            rndWait = this.getRndInteger(parseInt(max), parseInt(min))
        } else {
            rndWait = this.getRndInteger(parseInt(min), parseInt(max))
        }
        this.commands.push({action: "wait", value: rndWait})
    }

    command(command) {
        this.commands.push(command)
    }

    /**
     * Set user cookies for an automation, allowing sharing of sessions.
     * @param cookies An array of cookies to pass - output from AxiomApi.getCookies
     */
    setCookies(cookies) {
        this.commands.push({action: "cookie", cookies})
    }

    /**
     * Pass recorder data into the API.
     * @param raw An array of recording commands.
     */
    setRecorderData(raw) {
        for (const r of raw) {
            this.commands.push(r)
        }
    }

    smartScraper(selector, pager, page_count){
        this.smartScraperV070(selector, pager, page_count, 1)
    }

    smartScraperV070(selector, pager, page_count, start_page){
        this.smartScraperV071(selector, pager, page_count, start_page, 'textContent')
    }

    smartScraperV071(selector, pager, page_count, start_page, resultType){
        this.smartScraperV0130(selector, pager, page_count, start_page, 'textContent', null)
    }

    smartScraperV0130(selector, pager, page_count, start_page, resultType, timeout = null){
        this.smartScraperV0190(selector, pager, start_page, null, resultType, timeout = null, page_count)
    }

    smartScraperV0190(selector, pager, start_page, max_results, resultType, timeout = null, page_count = null) {
        this.smartScraperV210(selector, pager, start_page, max_results, resultType, timeout, '', page_count)
    }

    smartScraperV210(selector, pager, start_page, max_results, resultType, timeout, minWait, page_count = null) {
        const sb = AxiomApiHelper.buildSelectorArray(selector, resultType)
        this.commands.push({
            action: "smart_scrape", 
            selector: sb.selectors, 
            launchOptions: {
                moreSelector: pager, 
                maxResults: max_results, 
                scrollMax: page_count, 
                startPage: start_page, 
                resultType: sb.resultTypes, 
                timeout,
                minWait
            }
        })
    }

    linkScraper(selector, pager, page_count) {
        this.linkScraperV0130(selector, pager, page_count, null)
    }

    linkScraperV0130(selector, pager, page_count, timeout) {
        this.linkScraperV0190(selector, pager, null, timeout, page_count)
    }

    linkScraperV0190(selector, pager, max_results, timeout, page_count = null) {
        this.linkScraperV210(selector, pager, max_results, timeout, '', page_count)
    }

    linkScraperV210(selector, pager, max_results, timeout, minWait, page_count = null) {
        this.linkScraperV230(selector, pager, 1, max_results, timeout, minWait, page_count = null)
    }

    linkScraperV230(selector, pager, start_page, max_results, timeout, minWait, page_count = null) {
        this.smartScraperV210(selector, pager, start_page, max_results, "link", timeout, minWait, page_count)
    }


    /**
     * Select a value in a select list field
     * @param selector Selector of the select list
     * @param val Value to select
     */
    selectList(selector, val, name="Login Here") {
        this.commands.push({action: "select", selector, value: val, name: name})
    }

    /**
     * download a file from an element's src attr
     * @param selector Selector of the target element
     */
    downloadFile(selector, folder_path, fileName = '') {
        this.commands.push({action: 'download_file', selector, value: folder_path, launchOptions: {fileName}})
    }

    downloadFiles(selector, folder_path, fileName = '') {
        this.commands.push({action: 'download_files', selector, value: folder_path, launchOptions: {fileName, maxResults: 0}}) //defaults to all
    }

    getCurrentUrl() {
        this.commands.push({action: 'get_current_url'})
    }

    clearCookies() {
        this.commands.push({action: 'clear_cookies'})
    }

    instagramStoryReact(react) {
        this.commands.push({action: 'instagram_story_react', value: react})
    }

    instagramMessageReply(reply) {
        this.commands.push({action: 'instagram_message_reply', value: reply})
    }

    instagramRequestReply(reply) {
        this.commands.push({action: 'instagram_request_reply', value: reply})
    }

    instagramCommentReply(url) {
        this.commands.push({action: 'instagram_comment_reply', url: url})
    }
    
    code(script) {
        this.commands.push({action: 'code', value: script})
    }

    localStorage(values) {
        this.commands.push({action: 'localStorage', value: values})
    }

    switchBrowserTab(selected_tab) {
        this.commands.push({action: "switch_browser_tab", value: selected_tab})
    }

    mouseClickDrag(start_x, start_y, end_x, end_y) {
        this.commands.push({action: "mouse_click_drag", value: {start_x, start_y, end_x, end_y}})
    }

    /**
     * Runs the automation.
     * @param callback Callback function, receiving one parameter containing the results of the automation
     */
    run(callback, attempt = 1) {
        let headless = false
        let extensionToLoad = ''
        let executablePath = ''
        chrome.storage.local.get("toolbar", res => {
            if (res.hasOwnProperty('toolbar')) {
                headless = res.toolbar.task.data.headless
                extensionToLoad = res.toolbar.task.data.extensionToLoad
                executablePath = res.toolbar.task.data.executablePath
            }
        });
        appChecker.getInstalledVersion(true).then(v => {
            try {
                this.driverExecution.sendToDriver({
                    data: {
                        data: {
                            tooltiptime: this.tooltiptime,
                            headless,
                            code: {
                                puppeteer_data: this.commands
                            },
                            extensionToLoad,
                            executablePath
                        }
                    }
                }).then(res => {
                    if (res) {
                        callback(res);
                        if (attempt > 1) {
                            AxiomApiDriver.closeAxiomTab()
                        }
                    } else {
                        callback({error: `Failed ${this.commands.length} part automation (${e.name})`})
                    }
                })
            } catch (e) {
                callback({error: `Failed ${this.commands.length} part automation (${(e.name) ? e.name : e})`})
            }
        }, reject => {
            if (attempt == 1) {
                    chrome.tabs.create({ url: "axiomai://run" })
                }
                attempt++
                return AxiomApiHelper.delay(2000).then(() => {
                    if (attempt > 1 && attempt <= 4) {
                        return this.run(callback, attempt)
                    } else {
                        callback({error: "The Axiom desktop app is not running. Download or start it to begin automating!"})
                        AxiomApiDriver.closeAxiomTab()
                    }
            })
        })

    }

    async internalRun(callback, attempt=1) {
        let formattedCommands = []
        let tokenList = []
        let tokenValues = {}
        if (this.data) {
            for (let row = 0; row < this.data.length; row++) {
                // Create the tokens from the data and build the token compiler
                let dataRow = this.data[row]
                tokenList = []
                tokenValues = {}
                for (let i = 0; i < dataRow.length; i ++) {
                    tokenList.push({name: `[dataCol${i}]`})
                    tokenValues[`dataCol${i}`] = dataRow[i]
                }
                formattedCommands = await this.formatCommands(tokenList, tokenValues, row, formattedCommands)
            }
        } else {
            formattedCommands = await this.formatCommands(tokenList, tokenValues, 0, formattedCommands)
        }

        let headless = false
        let extensionToLoad = ''
        let executablePath = ''
        chrome.storage.local.get("toolbar", res => {
            if (res.hasOwnProperty('toolbar')) {
                headless = res.toolbar.task.data.headless
                extensionToLoad = res.toolbar.task.data.extensionToLoad
                executablePath = res.toolbar.task.data.executablePath
            }
            appChecker.getInstalledVersion(true).then(async v => {
                // TODO: This should get an array of sites it needs cookies from and fix them all at once.
                let urls = []
                for (const c of formattedCommands) {
                    if (c.url && c.url != '') {
                        urls.push(c.url)
                    }
                }
                
                // Add local storage values to start of axiom
                // Should check version to stop it passing storage values to a puppeteer that doesn't support them
                if (v.version > "2.0.0") {
                    const storage = await AxiomApiBrowser.getStorageValues(urls)
                    formattedCommands.unshift({action: "storage", value: storage})
                }
                
                // Add cookie values to start of Axiom
                AxiomApiBrowser.getCookies(urls, async cookies => {
                    let cookiesInfo = {}
                    for (let cookie of cookies) {
                        let domain = cookie.domain
                        if (cookiesInfo[domain] != undefined) {
                            cookiesInfo[domain] ++
                        } else {
                            cookiesInfo[domain] = 1
                        }
                    }
                    formattedCommands.unshift({action: "cookie", cookies})
                    // Load user data to check token at runtime
                    const cud = new CurrentUserData()
                    await cud.load()
                    // Send to driver
                    this.driverExecution.sendToDriver({
                        data: {
                            data: {
                                tooltiptime: this.tooltiptime,
                                headless,
                                viewport: this.options.defaultViewport,
                                code: {
                                    puppeteer_data: formattedCommands
                                },
                                extensionToLoad,
                                executablePath
                            },
                            user: {id: cud.id, token: cud.token}
                        }
                    }).then(res => {
                        if (res) {
                            callback(res);
                            if (attempt > 1) {
                                AxiomApiDriver.closeAxiomTab()
                            }
                        } else {
                            callback({error: `Failed ${this.commands.length} part automation (${e.name})`})
                        }
                    })
                })
            }, reject => {
                if (attempt == 1) {
                    chrome.tabs.create({ url: "axiomai://run" })
                }
                attempt++
                return AxiomApiHelper.delay(2000).then(() => {
                    if (attempt > 1 && attempt <= 4) {
                        return this.internalRun(callback,attempt)
                    } else {
                        callback({error: "Axiom app is not running"})
                        AxiomApiDriver.closeAxiomTab()
                    }
                })
            })
        })
    }

    formatCommands(tokenList, tokenValues, row, newCommands) {
        const tokenCompiler = new TokenCompiler({tokenList})
        tokenCompiler.setTokenValues(tokenValues)
        // Create commands
        for (let command of this.commands) {
            let formattedCommand = AxiomApiUtilities.clone(command)
            let keys = Object.keys(command)
            for (let key of keys) {
                // We have to do this because some "launchOptions" are actually data that should be replaced.
                if (key === "launchOptions") {
                    let lokeys = Object.keys(formattedCommand[key])
                    for (let lokey of lokeys) {
                        formattedCommand[key][lokey] = tokenCompiler.tokenReplaceString(formattedCommand[key][lokey])
                    }
                } else {
                    let formatted = tokenCompiler.tokenReplaceString(command[key])

                    // Handle tokens where the value can't be found
                    if (tokenCompiler.isToken(formatted)) {
                        formatted = ''
                    }

                    formattedCommand[key] = formatted
                }
            }

            newCommands.push(formattedCommand)
        }

        newCommands.push({action: 'loop_step_finished', value: row})

        return newCommands
    }

    
    static async runCommands(input, commands, driverExecution, callback, attempt=1) {
        let headless = false
        let extensionToLoad = ''
        let executablePath = ''
        chrome.storage.local.get("toolbar", res => {
            if (res.hasOwnProperty('toolbar')) {
                extensionToLoad = res.toolbar.task.data.extensionToLoad
                headless = res.toolbar.task.data.headless
                executablePath = res.toolbar.task.data.executablePath
            }
            appChecker.getInstalledVersion().then(async v => {
                let viewport = null
                if (process.env.CLOUD_ENV === "1") {
                    viewport = {width: 1920, height: 1080}
                }
                // Remove storage items from driver code if we aren't in the right version. Temporary hack!
                if (v.version <= "2.0.0") {
                    commands = commands.filter(command => command.action !== "storage")
                }
                // Load user data to check token at runtime
                const cud = new CurrentUserData()
                await cud.load()
                // Send to driver
                driverExecution.sendToDriver({
                    data: {
                        data: {
                            tooltiptime: this.tooltiptime,
                            headless,
                            viewport,
                            code: {
                                puppeteer_data: commands
                            },
                            extensionToLoad,
                            executablePath
                        },
                        user: {id: cud.id, token: cud.token}
                    }
                }).then(res => {
                    if (res) {
                        callback(res);
                        if (attempt > 1) {
                            AxiomApiDriver.closeAxiomTab()
                        }
                    }
                })
            }, error => {
                if (attempt == 1) {
                    chrome.tabs.create({ url: "axiomai://run" })
                }
                attempt++
                return AxiomApiHelper.delay(2000).then(() => {
                    if (attempt > 1 && attempt <= 4) {
                        return AxiomApiDriver.runCommands(input, commands,driverExecution,callback,attempt)
                    } else {
                        callback({error: "The Axiom desktop app is not running. Download or start it to begin automating!"})
                        AxiomApiDriver.closeAxiomTab()
                    }
                })
            })
        })
    }
}
