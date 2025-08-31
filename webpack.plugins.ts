import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin"
import { DefinePlugin } from "webpack"
import * as dotenv from "dotenv"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin")

// Load environment variables from .env file
dotenv.config()

export const plugins = [
  // new ForkTsCheckerWebpackPlugin({
  //   logger: 'webpack-infrastructure',
  // }),
  new DefinePlugin({
    'process.env.SPOTIFY_CLIENT_ID': JSON.stringify(process.env.SPOTIFY_CLIENT_ID),
    'process.env.SPOTIFY_CLIENT_SECRET': JSON.stringify(process.env.SPOTIFY_CLIENT_SECRET),
    'process.env.SPOTIFY_REDIRECT_URI': JSON.stringify(process.env.SPOTIFY_REDIRECT_URI),
  }),
]
