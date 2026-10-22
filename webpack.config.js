const webpack= require( 'webpack');

module.exports= {
  entry: "./out/index.js",
  output: {
    // output bundle will be in `dist/buit.js`
    filename: `built.js`,
  },
  target: 'node',
  mode: 'production',
  // optional: bundle everything into 1 file
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1
    })
  ],
};