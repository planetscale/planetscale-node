// This is not required for now. Tests are running with real generated keys

// jest.mock('@peculiar/crypto', () => ({
//   Crypto: jest.fn(() => {
//     return {
//       subtle: {
//         exportKey: jest.fn(() => {
//           const arrayBuffer = new ArrayBuffer(10)
//           return arrayBuffer
//         }),
//         generateKey: jest.fn().mockImplementation(() => {
//           return {
//             privateKey: 'privateKey',
//             publicKey: 'publicKey'
//           }
//         })
//       }
//     }
//   })
// }))
