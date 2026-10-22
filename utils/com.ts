import axios, { AxiosInstance, AxiosResponse } from "axios";
export type IMessageTypes = "e" | "w" | "n";
export interface IMessage {
  channel: string;
  type: IMessageTypes;
  title: string;
  message: string;
}
/**
 * Fetches CLI arguments passed form UICEngin
 * @created 2025-03-14 by Istyaq Ahmmed
 * @modified none
 */
export class Progress {
  channel: string;
  private applyCharge = true;
  private currentSL: number;
  private total: number;
  private complete: number;
  private failed: number;
  private speed: number;
  private title: string;
  private details: string;
  private com: LocalCom;
  private sessionID: string;
  private lastTime: Date;
  private smoothing:number=0.02;
  private statusBuffer: {
    remaining: number;
    size: number;
    success: number;
    failed: number;
  };
  /**
   * Creates new work session in uicomertial.com and returns response
   *
   * Reminders:
   * * Call {@link setTotal}
   * @param com LocalCom Instance
   * @param bufferSize Frequency of reporting to the Remote Server(>=1).
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified none
   */
  constructor(com: LocalCom) {
    this.com = com;
    this.currentSL = 1;
    this.channel = "d";
    this.total = 0;
    this.complete = 0;
    this.failed = 0;
    this.speed = 0;
    this.title = "Running...";
    this.details = "Looking for files";
    this.statusBuffer = {
      remaining: 999999999,
      size: 1,
      success: 0,
      failed: 0,
    };
  }
  /**
   * Sets number of total process
   * @param num Number to be set to.
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified 2025-04-18 by Istyaq Ahmmed
   */
  setTotal(num: number) {
    this.total = num;
    this.smoothing = Math.max(0.02, Math.min(0.3, 10 / num));

  }
  /**
   * Reset the update buffer.
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified none
   */
  private emptyStatusBuffer() {
    this.statusBuffer.success = 0;
    this.statusBuffer.failed = 0;
  }
  /**
   *Calculates and update Avg. time(speed)
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified 2025-04-18 by Istyaq Ahmmed
   */
  private updateAvgTime() {
    const now=new Date()
    const endTime = now.getTime();
    const timeTaken=(endTime - this.lastTime.getTime())/1000;
    if (this.speed == 0)
      this.speed = timeTaken;
    else {
      this.speed =this.smoothing * timeTaken + (1-this.smoothing) * this.speed; 
    }
    this.lastTime= now
  }
  async flushBuffer(){
    return this.updateBuffer()
  }
  /**
   * Update buffer and sends status when it overflows.
   * @param count Success count or failed count positive if success negative if failed.
   * @returns Response form Remote Server or buffer.
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified none
   */
  private async updateBuffer(count: number = 0) {
    this.updateAvgTime();
    if (count > 0) {
      this.complete += count;
      this.statusBuffer.remaining -= count;
      this.statusBuffer.success += count;
    } else {
      this.failed -= count;
      this.statusBuffer.failed -= count;
    }
    if (
      this.statusBuffer.failed + this.statusBuffer.success >=
        this.statusBuffer.size ||
      this.statusBuffer.remaining < 1
    ) {
      let resp 
      try{
        resp= await this.sendRemoteStatus({
          success: this.statusBuffer.success,
          fails: this.statusBuffer.failed,
        });
      }
      catch(e){
        return {
          continue: false,
          message: "Disconnected from UICommertial.com. Check your internet connection.",
        };
      }
      this.emptyStatusBuffer();
      if (resp.doNext) {
        this.statusBuffer.remaining = resp.remaining;
        return {
          continue: true,
          message: resp.message,
        };
      } else {
        return {
          continue: false,
          message: resp.message,
        };
      }
    } else {
      return {
        continue: true,
        message: "Good to go",
      };
    }
  }
  /**
   * Registers a successful process completion.
   * @param count Number of success
   * @returns status
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified 2025-04-07 by Istyaq Ahmmed
   */
  registerSuccess(count: number = 1) {
    this.incrementSL();
    return this.updateBuffer(count);
  }
  /**
   * Registers a process being failed.
   * @param count Number of failes
   * @returns status
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified 2025-04-07 by Istyaq Ahmmed
   */
  registerFail(count: number = 1) {
    this.incrementSL();
    return this.updateBuffer(-count);
  }
  /**
   * Increments Serial
   *@returns Current SL
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified none
   */
  incrementSL() {
    return this.currentSL++;
  }
  /**
   * Sets title and Message for tha status bar.
   * @param title Small Text
   * @param details Large Text
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified none
   */
  setTitleAndMessage(title: string = null, details: string = null) {
    if (title != null) {
      this.title = title;
    }
    if (details != null) {
      this.details = details;
    }
  }

  /**
   * Gets JSON serializable obj for status bar.
   * @returns JSON serializable obj for status bar.
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified none
   */
  getObj() {
    return {
      channel: this.channel,
      total: this.total,
      complete: this.complete,
      failed: this.failed,
      speed: this.speed,
      title: this.title,
      details: this.details,
    };
  }
  /**
   * Creates and gets the session.
   * @param pid Process ID.
   * @returns Response form Server.
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified 2025-04-07 by Istyaq Ahmmed
   */
  async getNewSession(bufferSize: number = 1,applyCharge=true) {
    this.applyCharge=applyCharge;
    this.statusBuffer.size=bufferSize;
    this.lastTime = new Date();
    let resp: {
      id: string;
      remaining: number;
      name?: string;
      message?: string;
      doNext?: boolean;
    };
    if (this.applyCharge && !this.com.CLIargs.devFlag) {
      try{
        resp = (await this.com.Proxy.get(`/protected/${this.com.pId}/newSession`))
        .data as {
            id: string;
            remaining: number;
            name: string;
            message: string;
            doNext: boolean;
          };
      }catch(e){
        return {
          id: "",
          remaining: 0,
          name: "Error",
          message: "Disconnected from UICommertial.com. Check your internet connection.",
          doNext: false,
        };
      }
      
    } else {
      resp = {
        id: "hh",
        remaining: Infinity,
        name: "OK",
        message: "No charge",
        doNext: true,
      };
    }
    if (resp && resp.id) {
      this.sessionID = resp.id;
      this.statusBuffer.remaining = Math.floor(resp.remaining);
      if(this.statusBuffer.remaining<this.total){
        this.com.sendData(null,
          [
              {
                  channel: this.channel,
                  type: 'w',
                  title: 'Balance Shortage',
                  message: `You have balance to complete only ${this.statusBuffer.remaining} of ${this.total}. Consider Recharging.`
              }
          ]
      )
      }
      return resp;
    } else
      return {
        id: "",
        remaining: 0,
        name: "Error",
        message: resp.message || "You don't have enough account ballance.",
        doNext: false,
      };
  }
  /**
   * Reports the status of task to Remote Server and verify permission to continue.
   * @param counts Status to Report to Remote Server.
   * @param counts.success Number of successes.
   * @param counts.fails Number of fails.
   * @returns  Response of Remote Server.
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified 2025-04-07 by Istyaq Ahmmed
   */
  async sendRemoteStatus(counts: { success: number; fails: number }) {
    let resp: {
      success: boolean;
      name?: string;
      remaining?: number;
      message?: string;
      doNext?: boolean;
    };
    console.log("send remote status")
    if (this.applyCharge && !this.com.CLIargs.devFlag) {
      resp = (
        await this.com.Proxy.post(`/protected/${this.com.pId}/session`, {
          id: this.sessionID,
          counts: counts,
        })
      ).data as {
        success: boolean;
        name: string;
        remaining: number;
        message: string;
        doNext: boolean;
      };
    } else {
      resp = {
        success: true,
        remaining: Infinity,
        name: "OK",
        message: "No charge",
        doNext: true,
      };
    }

    if (resp && resp.success) {
      return resp;
    } else
      return {
        id: "",
        remaining: 0,
        name: "Error",
        message: resp.message || "You don't have enough account ballance.",
        doNext: false,
      };
  }
}

/**
 
 * @created 2025-03-13 by Istyaq Ahmmed
 * @modified none
 */
class CLIargs {
  readonly token: string;
  readonly info: string;
  readonly dir: string;
  readonly driver: string;
  readonly localRoot: string = "http://127.0.0.1:4116";
  readonly devFlag: boolean = false;

  /**
   * Creates instance of CLIargs and Populates launch arguments.
   * @created 2025-03-15 by Istyaq Ahmmed.
   * @modified none
   */
  constructor() {
    const argvs = process.argv;
    argvs.push("");
    for (let i = 0; i < argvs.length; i++) {
      switch (argvs[i]) {
        case "--token":
          this.token = argvs[i + 1];
          break;

        case "--info":
          this.info = argvs[i + 1];
          break;

        case "--dir":
          this.dir = argvs[i + 1];
          break;
        case "--driver":
          this.driver = argvs[i + 1];
          break;
        case "--localRoot":
          this.localRoot = argvs[i + 1];
          break;
        case "--devFlag":
          this.devFlag = argvs[i + 1] == "true";
          break;
        default:
          break;
      }
    }
  }
}
/**
 * Manages Communication between The module and UICEngin
 * @created 2025-03-13 by Istyaq Ahmmed
 * @modified none
 */
export class LocalCom {
  readonly session: AxiosInstance;
  progress: Progress;
  readonly CLIargs: CLIargs;
  readonly pId: string;
  readonly Proxy: {
    get: (url: string) => Promise<AxiosResponse<unknown, unknown>>;
    post: (
      url: string,
      data: unknown,
    ) => Promise<AxiosResponse<unknown, unknown>>;
    patch: (
      url: string,
      data: unknown,
    ) => Promise<AxiosResponse<unknown, unknown>>;
    delete: (
      url: string,
      data: unknown,
    ) => Promise<AxiosResponse<unknown, unknown>>;
  };
  /**
   * Contractor of LocalCom
   * @param pId Process ID
   * @created 2025-03-14 by Istyaq Ahmmed.
   * @modified none
   */
  constructor(pId: string) {
    this.pId = pId;
    this.CLIargs = new CLIargs();

    this.session = axios.create({
      baseURL: this.CLIargs.localRoot,
      validateStatus: function (status) {
        return status < 500;
      },
    });

    this.session.interceptors.request.use(
      (config) => {
        config.headers["Authorization"] = `Bearer ${this.CLIargs.token}`;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );
    this.Proxy = {
      get: (url)=> this.get(url),
      post: (url,data)=> this.post(url,data),
      patch: (url,data)=> this.patch(url,data),
      delete: (url,data)=>this.delete(url,data),
    } as const;
    this.progress=new Progress(this);
  }
  /**
   * Set value of this.progress.
   * @param progress Instance of Progress
   * @created 2025-03-14 by Istyaq Ahmmed
   * @modified none
   */
  attachProgress(progress: Progress) {
    this.progress = progress;
  }
  /**
   * Data sending warper
   * @param TableData Data for main table
   * @param message Data for message table
   * @param log Data for dev log
   * @param MetaData Meta data
   * @returns Response from UICEnfin
   * @created 2025-03-14 by Istyaq Ahmmed.
   * @modified none
   */
  async sendData(
    TableData: unknown[] = null,
    message: IMessage[] = null,
    log: string[] = null,
    MetaData: unknown[] = null,
  ) {
    const data: {
      message?: IMessage[];
      MetaData?: unknown;
      log?: string[];
      TableData?: unknown[];
      status?: {
        channel: string;
        total: number;
        complete: number;
        failed: number;
        speed: number;
        title: string;
        details: string;
      }
    } = { status: this.progress.getObj() };

    if (message != null) {
      data.message = message;
    }
    if (MetaData != null) {
      data.MetaData = MetaData;
    }
    if (log != null) {
      console.log(log);
      data.log = log;
    }
    if (TableData != null) {
      data.TableData = TableData;
    }
    if (!this.CLIargs.devFlag)
      return (await this.session.post("/app/data", data, { timeout: 10000 })).data;
    else {
      // console.log(data)
      return;
    }
  }

  /**
   * Gets Launching arguments from UICEngine
   * @returns Init data from UIEngine
   * @created 2025-03-13 by Istyaq Ahmmed
   * @modified none
   */
  async getInitData() {
    const p = (await this.session.get("/app/init", { data: null })).data;
    console.log("initData", p);
    return p;
  }
  /**
   * Send Debug data to UIEngine
   * @param data Debug data
   * @created 2025-03-13 by Istyaq Ahmmed
   * @modified none
   */
  debug(data: unknown) {
    this.session.post("/debug", (data = { error: data }));
  }
  /**
   * Send Proxy method that sends requests to UICEngin
   * @param url Request url.
   * @param method Request Method.
   * @param data Request Payload.
   * @returns  Response of Proxy.
   * @created 2025-03-14 by Istyaq Ahmmed.
   * @modified none
   */
  private proxy(
    url: string,
    method: "get" | "post" | "patch" | "delete",
    data: unknown,
  ) {
    return this.session.post(
      `${this.CLIargs.localRoot}/app/proxy`,
      {
        url: url,
        method: method,
        payload: data,
      },
      {
        timeout: 10000,
      },
    );
  }
  /**
   * Private warper method for get api
   * @param url relative get url and parameters
   * @returns  Response of remote server.
   * @created 2025-03-14 by Istyaq Ahmmed.
   * @modified none
   */
  private get(url: string) {
    return this.proxy(url, "get", null);
  }
  /**
   * Private warper method for post api
   * @param url Relative post url and parameters
   * @param data Payload.
   * @returns  Response of remote server.
   * @created 2025-03-14 by Istyaq Ahmmed.
   * @modified none
   */
  private post(url: string, data: unknown) {
    return this.proxy(url, "post", data);
  }
  /**
   * Private warper method for patch api
   * @param url Relative patch url and parameters
   * @param data Payload.
   * @returns  Response of remote server.
   * @created 2025-03-14 by Istyaq Ahmmed.
   * @modified none
   */
  private patch(url: string, data: unknown) {
    return this.proxy(url, "patch", data);
  }
  /**
   * Private warper method for delete api
   * @param url Relative delete url and parameters
   * @param data Payload.
   * @returns  Response of remote server.
   * @created 2025-03-14 by Istyaq Ahmmed.
   * @modified none
   */
  private delete(url: string, data: unknown) {
    return this.proxy(url, "delete", data);
  }
}
