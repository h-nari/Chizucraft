# Chizucraft

map tool for minecraft

このプログラムは
現実の地図をマインクラフトの世界に
再現するためのツールです。
[国土地理院のベクタータイル地図](https://maps.gsi.go.jp/development/ichiran.html)から
道路端と建物輪郭の情報を抜き出し、
マインクラフトのブロック(1m)単位で表示します。

以下のURLで使用可能です。

<a href="https://h-nari.github.io/Chizucraft/">
https://h-nari.github.io/Chizucraft/</a>

<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215a1.png" width="300">
<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215b1.png" width="300">

# 使い方

このプログラムは２つのタブから構成されています。
「地理院地図」タブと「Minecraft地図」タブです。

## 「地理院地図」タブ

このタブでは
地理院タイル情報を
オープンソースの地図ソフト、[leaflet](https://leafletjs.com/)を使用して
表示しています。Google Map等の地図ソフトと同様に
使用することができます。
それに加えてマーカーと基準点の設定ができます。

### マーカー

<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215a2.png" width="300">

マーカーとは正方形の領域で、
128m x 128m から 2048m x 2048mの5種類のサイズの
正方形を地図上に表示できます。
これらのサイズはマインクラフトの地図で表示できる
範囲のサイズです。
このマーカーを使って
マインクラフト上に再現させたい領域の範囲のあたりを
つけることができます。

マーカーは地図に固定されていますが、
メニューで「マーカーを画面に固定」を選択すると
画面に固定されます。この状態で地図を動かすことで
マーカーの位置を調整可能です。
Ctrlキーを押しながら地図をドラッグすることでも
マーカーの位置を調整可能です。

### 基準点

地理院の地図データは
メルカトル座標で描かれていますので
緯度によってスケールが変わります。
地球は曲面なので
同じスケールでは平面に描くことができないからです。
そこで妥協します。
基準点を決め、その位置でのスケールでマインクラフトの地図へ
変換することにします。
基準点の近辺であれば精度は問題ないと思います。
基準点から遠く離れると、おかしな事になるでしょう。

基準点は、メニューからマーカーの中心位置に設定することが
できます。 マインクラフト側での作業を始めてから
基準点の位置がずれてしまうと、ややこしいことになりそうですので、
保存しておくことをお薦めします。
基準点の位置は
「設定をセーブ」機能で
他の情報を一緒にファイルとしてダウンロード可能です。

## 「Minecraft地図」タブ

基準点を設定すると「Minecraft地図」タブが表示可能になります。
このタブで表示可能な地図は以下の4種類です。




* 地理院地図：国土地理院の[標準地図](https://maps.gsi.go.jp/development/ichiran.html#std2)
<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215a3.png" width="250">
* 航空写真：国土地理院の[写真](https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto)
<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215a4.png" width="250">
* [OpenStreetMap](https://openstreetmap.jp/)
<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215a5.png" width="250">
* 地理院ベクター: 国土地理院の [ベクタータイル](https://maps.gsi.go.jp/development/vt.html) を描画したもの
<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215a1.png" width="250">

マウスのドラッグ操作、ホイール操作で
「地理院地図」タブと同様に地図の移動、拡大縮小ができます。
ベクター地図は他の地図と比べて描画に時間がかかりますので
注意してください。

地図の上にはマインクラフトのブロック単位でのグリッドを表示可能です。
グリッドのサイズは1m,4m,16m,128mでスケールに応じて表示されます。
地図の上辺にはマインクラフトのX座標、左辺にはZ座標が表示されます。

マウスをクリックするとカーソル位置のブロックが選択され
マインクラフトの座標が表示されます。
ブロックのマインクラフト座標は
メニューの「移動/マインクラフトの座標設定」で設定できます。

<img src="https://raw.githubusercontent.com/h-nari/Chizucraft/main/img/sc211215a6.png" width="250">

ベクター地図でスケールが1ブロック4pixel以上になると
道路端と建物輪郭がブロック単位で描画されます。

## 最後に

拙いプログラムですが
マインクラフト・ライブの助けになれば幸いです。

