# Grid Golf 3D

A 3D mini golf game built with Three.js, featuring physics-based gameplay with dice mechanics and multiple shot types.

## 🎮 Game Features

- **3D Graphics**: Built with Three.js for immersive 3D gameplay
- **Physics Simulation**: Uses Oimo.js for realistic physics
- **Dice-based Mechanics**: Roll dice to determine shot distance and shape
- **Multiple Shot Types**: Straight shots, draws, fades, slices, and hooks
- **Terrain Variety**: Different tile types including fairway, rough, sand, water, and trees
- **Slopes**: Dynamic terrain with directional slopes that affect ball movement
- **Stroke Tracking**: Keep track of your strokes and par for each hole
- **Random Hole Generation**: Generate new holes with varying layouts

## 🏌️ How to Play

1. **Roll Dice**: Click "Roll Dice" to determine your shot distance and shape
2. **Shot Selection**: Different dice types available:
   - Driver: Long distance (4-10 tiles)
   - Long iron: Medium distance (3-5 tiles)
   - Mid iron: Short-medium distance (2-3 tiles)
   - Wedge: Short distance (2-3 tiles)
   - Chip shot: Very short distance (1-2 tiles)
3. **Putt**: Use the putt button for precise 1-tile movements
4. **Terrain Effects**: Different surfaces affect your game:
   - Fairway: Best for distance
   - Rough: Reduces shot effectiveness
   - Sand: Difficult to play from
   - Water: Penalty strokes
   - Trees: Obstacles to navigate around
5. **Get to the Hole**: Reach the hole in as few strokes as possible!

## 🚀 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd grid-golf-three
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

### Running the Game Locally

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   - The game will automatically open at `http://localhost:5173` (or another port if 5173 is busy)
   - You'll see the port number in your terminal output

3. **Play the game!**
   - Use your mouse to look around the 3D environment
   - Click the UI buttons to roll dice and make shots
   - Try to get your ball to the hole in the fewest strokes

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## 🛠️ Development

### Project Structure

```
grid-golf-three/
├── index.html          # Main HTML file
├── main.js              # Main game logic and Three.js setup
├── package.json         # Dependencies and scripts
├── Tiles/               # Game assets (tile textures)
│   ├── tile_0000.png
│   ├── tile_0001.png
│   └── ...
└── node_modules/        # Dependencies
```

### Key Technologies

- **Three.js**: 3D graphics and rendering
- **Oimo.js**: Physics simulation
- **GSAP**: Animations and tweening
- **Vite**: Build tool and development server

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🎯 Game Controls

- **Mouse**: Look around the 3D environment
- **Roll Dice Button**: Roll for shot distance and shape
- **Putt Button**: Make a 1-tile precision shot
- **New Hole Button**: Generate a new hole layout

## 📝 Game Rules

- Each hole has a par (target number of strokes)
- Try to reach the hole in as few strokes as possible
- Different terrain types affect ball behavior
- Slopes will influence ball movement after landing
- Water hazards and trees create strategic challenges

## 🔧 Troubleshooting

### Common Issues

1. **Game won't start**
   - Make sure you have Node.js installed
   - Run `npm install` to ensure all dependencies are installed
   - Check the console for error messages

2. **Performance issues**
   - Try refreshing the browser
   - Close other browser tabs to free up memory
   - Ensure your graphics drivers are up to date

3. **Controls not working**
   - Make sure you're clicking on the game canvas
   - Try refreshing the page

## 🤝 Contributing

Feel free to contribute to this project! Some areas for improvement:

- Add more terrain types
- Implement multiplayer functionality
- Add sound effects and music
- Create more complex hole layouts
- Add weather effects

## 📄 License

This project is licensed under the ISC License.

---

Enjoy playing Grid Golf 3D! 🏌️‍♂️⛳
