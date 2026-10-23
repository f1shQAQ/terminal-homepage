// twikoo 的 npm 包没有自带类型，这里只声明用到的部分
declare module 'twikoo' {
  interface InitOptions {
    envId: string;
    el: string | HTMLElement;
    path?: string;
    lang?: string;
  }
  const twikoo: {
    version: string;
    init(options: InitOptions): Promise<void>;
  };
  export default twikoo;
}
