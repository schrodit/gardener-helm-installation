
export enum CharacterSet {
    AlphaNumerical = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    AlphaNumericalLowerCase = 'abcdefghijklmnopqrstuvwxyz0123456789',
}

export const randomString = (length: number, charSet: CharacterSet = CharacterSet.AlphaNumerical): string => {
    let result           = '';
    const characters       = charSet;
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
};
