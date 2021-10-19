const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { webpack } = require('webpack');


var app = {
    mode: 'development',
    target: 'web',
    entry: path.join(__dirname, 'src', 'app.ts'),
    output: {
        filename: 'app.js',
        path: path.resolve(__dirname, 'dist')
    },
    node: {
        __dirname: false,
        __filename: false
    },
    module: {
        rules: [{
            test: /.ts?$/,
            include: [
                path.resolve(__dirname, 'src'),
            ],
            exclude: [
                path.resolve(__dirname, 'node_modules'),
            ],
            loader: 'ts-loader',
        }]
    },
    resolve: {
        extensions: ['.js', '.ts']
    },
};

var css = {
    mode: 'development',
    entry: {
        style: path.join(__dirname, 'src', 'app.scss')
    },
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'app.css'
    },
    module: {
        rules: [
            {
                test: /\.scss/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                    },
                    {
                        loader: "css-loader",
                        options: {
                            sourceMap: true,
                            importLoaders: 2
                        }
                    },
                    {
                        loader: "sass-loader",
                        options: { sourceMap: true }
                    }
                ]
            }
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: 'style.css' }),
    ]
}

module.exports = [app, css];
