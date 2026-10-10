import type { Diagram, DiagramItem, DiagramItemKind, DiagramPath, DiagramPathKind, RinkView } from '../shared/domain.ts';

// ---------------------------------------------------------------------------
// Compact helpers for authoring rink diagrams (coordinates in feet, 200 x 85).
// Landmarks: goal lines x=11/189, blue lines x=75/125, centre x=100,
// end-zone dots (31|169, 20.5|64.5), neutral dots (80|120, 20.5|64.5).
// ---------------------------------------------------------------------------
let seq = 0;
const nid = () => `s${++seq}`;
const it = (kind: DiagramItemKind, x: number, y: number, label?: string): DiagramItem => ({ id: nid(), kind, x, y, ...(label ? { label } : {}) });
const F = (x: number, y: number, l?: string) => it('F', x, y, l);
const D = (x: number, y: number, l?: string) => it('D', x, y, l);
const G = (x: number, y: number) => it('G', x, y);
const X = (x: number, y: number, l?: string) => it('X', x, y, l);
const C = (x: number, y: number) => it('C', x, y);
const puck = (x: number, y: number) => it('puck', x, y);
const cone = (x: number, y: number) => it('cone', x, y);
const ln = (kind: DiagramPathKind, ...points: [number, number][]): DiagramPath => ({ id: nid(), kind, points });
const dia = (view: RinkView, items: DiagramItem[], paths: DiagramPath[] = []): Diagram => ({ view, items, paths });

export interface LibraryDrill {
  name: string;
  category: string;
  description: string;
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  age_levels: string[];
  focus_areas: string[];
  skills: string[];
  coaching_points: string[];
  equipment: string[];
  diagram: Diagram | null;
}

const ALL = ['U11', 'U13', 'U15', 'U16', 'U18', 'Junior'];
const MID = ['U13', 'U15', 'U16', 'U18'];
const OLDER = ['U15', 'U16', 'U18', 'Junior'];

export const LIBRARY_DRILLS: LibraryDrill[] = [
  {
    name: 'Dynamic Warm-Up Flow',
    category: 'skating',
    description: 'Players skate the full ice in two lines working through forward strides, crossovers through the circles, backward C-cuts, and tight turns at each blue line. Gradually build pace.',
    duration: 8,
    intensity: 'low',
    age_levels: ALL,
    focus_areas: [],
    skills: ['skating'],
    coaching_points: ['Full extension and recovery on every stride', 'Knees bent, chest up', 'Build to 80% pace by the end'],
    equipment: ['Pucks (optional)'],
    diagram: dia('full', [F(20, 10), F(20, 75), cone(100, 42.5)], [ln('skate', [20, 10], [100, 8], [180, 12], [180, 42], [120, 42]), ln('skate', [20, 75], [100, 77], [180, 73], [180, 46], [120, 44])]),
  },
  {
    name: 'Edge Control Figure-8s',
    category: 'skating',
    description: 'Players skate figure-8 patterns around the two end-zone faceoff circles, focusing on deep inside and outside edges. Progress to carrying a puck and finishing with a shot.',
    duration: 8,
    intensity: 'medium',
    age_levels: ALL,
    focus_areas: ['individual'],
    skills: ['skating', 'puck-skills'],
    coaching_points: ['Weight over the balls of the feet', 'Knee over toe on inside edge', 'Eyes up — look where you are going', 'Progress: add a puck, then finish with a shot'],
    equipment: ['Pucks', 'Cones'],
    diagram: dia('dzone', [F(31, 42.5), cone(31, 20.5), cone(31, 64.5), G(14, 42.5)], [ln('carry', [31, 42.5], [44, 30], [31, 8], [18, 20], [31, 32], [44, 55], [31, 77], [18, 64], [31, 52])]),
  },
  {
    name: 'Crossover Circles & Transitions',
    category: 'skating',
    description: 'Players work forward and backward crossovers around each circle on the whistle, then transition (forward-to-backward pivot) at the top of the circle and sprint to the blue line.',
    duration: 6,
    intensity: 'medium',
    age_levels: ALL,
    focus_areas: ['individual', 'd-zone'],
    skills: ['skating'],
    coaching_points: ['Push with the under-leg — don’t just step over', 'Pivots: open hips, keep stick on the ice', 'Explode out of the transition'],
    equipment: ['Cones'],
    diagram: dia('ozone', [F(169, 20.5), F(169, 64.5), cone(169, 42.5)], [ln('skate', [169, 6], [184, 20], [169, 35], [154, 20], [169, 6]), ln('backward', [169, 50], [154, 64], [169, 79], [184, 64]), ln('skate', [154, 20], [126, 20])]),
  },
  {
    name: 'Defensive Pivot Mirror',
    category: 'skating',
    description: 'Defencemen face a forward across a lane of cones. The forward attacks laterally and vertically; the defender mirrors with backward skating and pivots, keeping body position inside the dots.',
    duration: 8,
    intensity: 'medium',
    age_levels: MID,
    focus_areas: ['d-zone', 'neutral-zone', 'individual'],
    skills: ['skating', 'positioning'],
    coaching_points: ['Stick on the puck, eyes on the chest', 'Shuffle short, pivot when the attacker turns up ice', 'Keep a stick-length gap'],
    equipment: ['Cones'],
    diagram: dia('neutral', [F(120, 30), D(95, 30), F(120, 60), D(95, 60), cone(110, 20), cone(110, 40), cone(110, 50), cone(110, 70)], [ln('carry', [120, 30], [112, 20], [104, 38]), ln('backward', [95, 30], [86, 24], [80, 36])]),
  },
  {
    name: 'Catch-and-Release Shooting Lanes',
    category: 'shooting',
    description: 'Coach passes from the corner to shooters coming down the slot in two lines. Shooters receive and release in one motion, alternating forehand and backhand catches.',
    duration: 10,
    intensity: 'medium',
    age_levels: ALL,
    focus_areas: ['individual'],
    skills: ['shooting', 'puck-skills'],
    coaching_points: ['Receive the puck in shooting position — off the front foot', 'Cup the blade, cushion the pass', 'Release within one second of the catch', 'Pick a target before the pass arrives'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('ozone', [C(180, 75), F(130, 30), F(130, 55), G(186, 42.5), puck(180, 75)], [ln('pass', [180, 75], [158, 48]), ln('skate', [130, 30], [158, 46]), ln('shot', [158, 46], [186, 42.5])]),
  },
  {
    name: 'Net-Front Tips & Rebounds',
    category: 'shooting',
    description: 'D at the point shoot low for a forward stationed at the net front to tip; a second forward attacks rebounds from the weak side.',
    duration: 10,
    intensity: 'medium',
    age_levels: MID,
    focus_areas: ['special-teams', 'individual'],
    skills: ['shooting', 'compete', 'positioning'],
    coaching_points: ['Stick on the ice, blade angled to redirect', 'Low, hard and on net from the point', 'Rebound player: arrive on the shot, not after'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('ozone', [D(132, 30), F(180, 46), F(165, 66), G(186, 42.5), puck(132, 30)], [ln('shot', [132, 30], [180, 45]), ln('skate', [165, 66], [181, 50])]),
  },
  {
    name: 'Three-Shot Rapid Fire',
    category: 'shooting',
    description: 'Shooter takes three quick shots from three spots (high slot, mid-slot, low) with pucks pre-placed. Builds quick release and gives the goalie tracking reps.',
    duration: 8,
    intensity: 'high',
    age_levels: ALL,
    focus_areas: ['individual'],
    skills: ['shooting'],
    coaching_points: ['Reset feet quickly between shots', 'Shoot for corners, not the crest', 'Goalie: square up, set before each release'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('ozone', [F(150, 42.5), puck(152, 42.5), puck(162, 34), puck(172, 50), G(186, 42.5)], [ln('shot', [152, 42.5], [186, 40]), ln('skate', [152, 42.5], [162, 34]), ln('skate', [162, 34], [172, 50])]),
  },
  {
    name: 'Low-High Point Shots Through a Screen',
    category: 'shooting',
    description: 'Forward on the half-wall passes up to the point; D walks the line to open a lane and shoots through a screener. Rotate D every rep.',
    duration: 10,
    intensity: 'medium',
    age_levels: OLDER,
    focus_areas: ['special-teams'],
    skills: ['shooting', 'decision-making'],
    coaching_points: ['Walk the line to change the shooting angle', 'Shot pass to sticks is a good option', 'Screener: stand on the goalie’s eyes, stick down'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('ozone', [F(160, 12), D(130, 25), F(180, 44), G(186, 42.5), puck(160, 12)], [ln('pass', [160, 12], [131, 24]), ln('skate', [130, 25], [130, 40]), ln('shot', [130, 40], [185, 43])]),
  },
  {
    name: 'D-to-Wing Rim & Bump',
    category: 'passing',
    description: 'D retrieves a dump-in and rims or passes to the winger on the wall. The winger receives on the boards and bumps to the centre swinging low. Builds timing between D, winger and centre.',
    duration: 10,
    intensity: 'medium',
    age_levels: MID,
    focus_areas: ['breakout'],
    skills: ['puck-skills', 'decision-making', 'hockey-iq'],
    coaching_points: ['Winger: be on the wall at the hash marks BEFORE the puck arrives', 'Open up to the middle — receive on the forehand when possible', 'Centre swings low and supports underneath'],
    equipment: ['Pucks'],
    diagram: dia('dzone', [D(14, 64), F(31, 80, 'W'), F(40, 50, 'C'), puck(14, 64), X(60, 60)], [ln('pass', [14, 66], [10, 80], [28, 82]), ln('skate', [40, 50], [36, 62], [44, 70]), ln('pass', [31, 80], [44, 72])]),
  },
  {
    name: 'Triangle Passing in Motion',
    category: 'passing',
    description: 'Groups of three skate through the neutral zone keeping a moving triangle, making tape-to-tape passes on the move. Add a passive defender as a progression.',
    duration: 8,
    intensity: 'medium',
    age_levels: ALL,
    focus_areas: ['neutral-zone'],
    skills: ['puck-skills', 'hockey-iq'],
    coaching_points: ['Give a target with your stick', 'Pass into space ahead of the receiver', 'Keep spacing — no two players in the same lane'],
    equipment: ['Pucks'],
    diagram: dia('neutral', [F(80, 25), F(80, 60), F(100, 42.5), puck(80, 25)], [ln('pass', [80, 25], [100, 42]), ln('pass', [100, 42.5], [80, 60]), ln('skate', [80, 60], [120, 62])]),
  },
  {
    name: 'Neutral Zone Regroup',
    category: 'passing',
    description: 'Forwards attack, pass back to D at the red line, then swing and regroup to attack again with speed. D-to-D pass to change the point of attack.',
    duration: 10,
    intensity: 'medium',
    age_levels: MID,
    focus_areas: ['neutral-zone', 'breakout'],
    skills: ['hockey-iq', 'puck-skills', 'decision-making'],
    coaching_points: ['Forwards stretch, then curl back — never stand still', 'D: move the puck within two touches', 'Attack with width and speed'],
    equipment: ['Pucks'],
    diagram: dia('full', [D(70, 30), D(70, 55), F(110, 15), F(110, 70), F(105, 42.5), puck(70, 30)], [ln('pass', [70, 30], [70, 54]), ln('skate', [110, 15], [92, 22], [120, 30]), ln('pass', [70, 55], [118, 32])]),
  },
  {
    name: 'Give-and-Go Two-Line',
    category: 'passing',
    description: 'Two lines at the blue line. First player passes to coach, skates into space and receives the return, finishes with a shot. Alternate sides.',
    duration: 8,
    intensity: 'medium',
    age_levels: ALL,
    focus_areas: ['individual', 'neutral-zone'],
    skills: ['puck-skills', 'shooting', 'skating'],
    coaching_points: ['Pass and move immediately', 'Accelerate into the return pass', 'Head up when receiving at speed'],
    equipment: ['Pucks', 'Net'],
    diagram: dia('ozone', [F(126, 15), C(150, 42.5), G(186, 42.5), puck(126, 15)], [ln('pass', [126, 15], [149, 41]), ln('skate', [126, 15], [165, 25]), ln('pass', [150, 42.5], [165, 26]), ln('shot', [165, 26], [186, 41])]),
  },
  {
    name: 'Gap Control 1-on-1',
    category: 'defensive',
    description: 'Forward picks up a puck at the far blue line and attacks; defender starts at the near blue line and must close the gap, match speed and steer the attacker to the outside.',
    duration: 10,
    intensity: 'high',
    age_levels: MID,
    focus_areas: ['d-zone', 'neutral-zone', 'individual'],
    skills: ['skating', 'positioning', 'compete'],
    coaching_points: ['Close the gap early — skate forward before pivoting', 'Inside-out position: own the middle', 'Stick on puck, body on body', 'Finish with a controlled check or angle into boards'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('full', [F(125, 20), D(75, 42.5), G(14, 42.5), puck(126, 22)], [ln('carry', [125, 20], [80, 22], [40, 18]), ln('skate', [75, 42.5], [90, 32]), ln('backward', [90, 32], [50, 26])]),
  },
  {
    name: 'Net-Front Box-Out Battles',
    category: 'defensive',
    description: 'Defender and forward battle for position in front of the net while a coach shoots from the point. Defender must establish inside position, tie up the stick, and clear rebounds.',
    duration: 8,
    intensity: 'high',
    age_levels: OLDER,
    focus_areas: ['d-zone'],
    skills: ['compete', 'positioning'],
    coaching_points: ['Get inside position before the shot', 'Tie up the stick, not the body', 'Eyes on the puck — find it after the shot', 'Clear rebounds to the corners, never the middle'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('dzone', [D(18, 45), X(22, 40), C(70, 30), G(14, 42.5), puck(70, 30)], [ln('shot', [70, 30], [14, 42])]),
  },
  {
    name: 'Angling & Stick Position',
    category: 'defensive',
    description: 'Defender angles the puck carrier toward the boards using a curved approach, stick in the passing lane. Progress from walk-throughs to live 1-on-1 in a lane.',
    duration: 8,
    intensity: 'medium',
    age_levels: ALL,
    focus_areas: ['forecheck', 'd-zone'],
    skills: ['positioning', 'hockey-iq', 'skating'],
    coaching_points: ['Approach from the inside — take away the middle', 'Stick in the lane, then body', 'Don’t over-skate the carrier'],
    equipment: ['Pucks', 'Cones'],
    diagram: dia('ozone', [X(170, 70), F(150, 45), puck(170, 72)], [ln('carry', [170, 70], [150, 80]), ln('skate', [150, 45], [160, 66], [150, 78])]),
  },
  {
    name: 'Low-Zone 2-on-2 Coverage',
    category: 'defensive',
    description: 'Two defenders vs two attackers below the hash marks. Defenders communicate switch/stay and protect the house; coach adds pucks every 20 seconds.',
    duration: 10,
    intensity: 'high',
    age_levels: OLDER,
    focus_areas: ['d-zone'],
    skills: ['positioning', 'compete', 'hockey-iq'],
    coaching_points: ['Talk: "I’ve got man", "switch"', 'One pressures, one protects the net front', 'Stick in passing lanes to the slot'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('dzone', [D(25, 60), D(20, 42), X(15, 70), X(35, 45), G(14, 42.5), C(60, 42.5), puck(15, 72)], [ln('skate', [25, 60], [17, 68])]),
  },
  {
    name: 'Winger Wall Support Breakout',
    category: 'tactics',
    description: 'Teaches wingers to hold the wall until the puck is secured. D retrieves a dump-in under light pressure; the strong-side winger must be stopped on the wall at the hash marks facing the play, receive, and make a play (bump to centre, chip out, or skate). Weak-side winger stays above the circle as an outlet, not at the far blue line.',
    duration: 12,
    intensity: 'medium',
    age_levels: MID,
    focus_areas: ['breakout'],
    skills: ['positioning', 'hockey-iq', 'decision-making'],
    coaching_points: [
      'Wingers: stop on the wall, don’t glide — feet still, stick on the ice',
      'Don’t leave the zone until our team has clear possession',
      'Shoulder-check before the puck arrives',
      'Weak-side winger: support in the middle lane, high slot',
      'Centre: low support, available for a short bump',
    ],
    equipment: ['Pucks'],
    diagram: dia(
      'dzone',
      [D(12, 60), D(26, 30), F(36, 80, 'LW'), F(36, 8, 'RW'), F(30, 50, 'C'), X(48, 66), puck(12, 62), cone(36, 76)],
      [ln('pass', [12, 62], [34, 78]), ln('skate', [30, 50], [40, 64]), ln('pass', [36, 80], [40, 66]), ln('skate', [36, 8], [55, 20], [60, 35])],
    ),
  },
  {
    name: 'Five-Man Breakout Walkthrough',
    category: 'tactics',
    description: 'Full unit (2 D + 3 F) walks through then executes each breakout option against no pressure: up the strong-side wall, D-to-D, reverse, and centre swing. Coach calls the option.',
    duration: 12,
    intensity: 'low',
    age_levels: MID,
    focus_areas: ['breakout'],
    skills: ['hockey-iq', 'positioning'],
    coaching_points: ['Communicate: D calls the option early', 'Every player has a job before the puck is touched', 'Execute at walking pace, then half, then full speed'],
    equipment: ['Pucks'],
    diagram: dia('full', [D(14, 50), D(30, 25), F(36, 78), F(36, 8), F(40, 50), puck(14, 52)], [ln('pass', [14, 52], [34, 76]), ln('skate', [40, 50], [60, 60]), ln('skate', [36, 8], [80, 15])]),
  },
  {
    name: 'Reverse Breakout vs Pressure',
    category: 'tactics',
    description: 'F1 pressures the puck-retrieving D hard; D uses the net to reverse the puck behind to partner, who moves it up the weak-side wall.',
    duration: 10,
    intensity: 'medium',
    age_levels: OLDER,
    focus_areas: ['breakout', 'forecheck'],
    skills: ['decision-making', 'puck-skills'],
    coaching_points: ['D partner calls "reverse" early', 'Use the net as a pick', 'Weak-side winger supports low'],
    equipment: ['Pucks', 'Net'],
    diagram: dia('dzone', [D(15, 66), D(18, 20), X(35, 66), F(36, 8), puck(15, 68)], [ln('carry', [15, 66], [6, 50]), ln('pass', [6, 50], [10, 24]), ln('pass', [18, 20], [34, 9])]),
  },
  {
    name: '1-2-2 Forecheck Shadow',
    category: 'tactics',
    description: 'Forwards walk through 1-2-2 forecheck positioning against a coach moving the puck around the opposition end. F1 angles, F2 and F3 take away the walls, D hold the blue line.',
    duration: 10,
    intensity: 'low',
    age_levels: MID,
    focus_areas: ['forecheck'],
    skills: ['positioning', 'hockey-iq'],
    coaching_points: ['F1 angles to the boards — force the puck one way', 'F2 / F3 read the wall: pinch on the strong side', 'D: gap up, but never get beat wide'],
    equipment: ['Pucks'],
    diagram: dia('ozone', [F(175, 55, 'F1'), F(150, 75, 'F2'), F(150, 10, 'F3'), D(130, 65), D(130, 20), X(186, 60), puck(188, 60)], [ln('skate', [175, 55], [184, 66])]),
  },
  {
    name: 'F1 Pressure, F2 Read 2-on-2',
    category: 'tactics',
    description: 'Coach dumps the puck in; two forecheckers vs two breakout players. F1 forces the play, F2 reads and attacks the outlet. Live until whistle.',
    duration: 10,
    intensity: 'high',
    age_levels: OLDER,
    focus_areas: ['forecheck'],
    skills: ['compete', 'hockey-iq', 'decision-making'],
    coaching_points: ['F1: approach on an angle, finish the check', 'F2: read F1 — attack the outlet, not the puck carrier', 'Recover quickly if the puck gets out'],
    equipment: ['Pucks', 'Net'],
    diagram: dia('ozone', [F(160, 45, 'F1'), F(150, 20, 'F2'), X(186, 65), X(175, 15), puck(188, 66)], [ln('skate', [160, 45], [184, 62]), ln('skate', [150, 20], [168, 16])]),
  },
  {
    name: '1-3-1 Neutral Zone Shell',
    category: 'tactics',
    description: 'Walkthrough of the 1-3-1 neutral-zone setup vs a regrouping opponent. F1 steers, the middle three seal the red line, the last D stays deep.',
    duration: 10,
    intensity: 'low',
    age_levels: OLDER,
    focus_areas: ['neutral-zone'],
    skills: ['positioning', 'hockey-iq'],
    coaching_points: ['F1 forces the puck to one side', 'The "3" move as a unit — side to side', 'Deep D reads stretch passes'],
    equipment: ['Pucks'],
    diagram: dia('full', [F(120, 42.5, 'F1'), F(100, 15), F(100, 42.5), D(100, 70), D(70, 42.5), X(150, 30), X(150, 55)], []),
  },
  {
    name: 'Power Play Umbrella Rotation',
    category: 'tactics',
    description: '5-on-0 then 5-on-4 rotation in the umbrella (1-3-1) setup. Focus on puck movement, the bumper option and shot creation.',
    duration: 12,
    intensity: 'medium',
    age_levels: OLDER,
    focus_areas: ['special-teams'],
    skills: ['decision-making', 'puck-skills', 'hockey-iq'],
    coaching_points: ['Move the puck quickly — make the box shift', 'Bumper stays available in the soft middle', 'Shoot with a purpose: net-front screen and rebounds'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('ozone', [D(130, 42.5), F(160, 12), F(160, 73), F(150, 42.5), F(181, 45), puck(130, 43)], [ln('pass', [130, 42.5], [159, 14]), ln('pass', [160, 12], [150, 41])]),
  },
  {
    name: 'Penalty Kill Box Rotation',
    category: 'tactics',
    description: 'Four penalty killers hold a box vs five attackers moving the puck. Killers rotate on each pass, keep sticks in lanes and pressure on the half-wall when the puck is bobbled.',
    duration: 10,
    intensity: 'medium',
    age_levels: OLDER,
    focus_areas: ['special-teams', 'd-zone'],
    skills: ['positioning', 'hockey-iq'],
    coaching_points: ['Keep the box tight — protect the middle', 'Sticks in the seam passing lanes', 'Pressure on bobbles and bad touches'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('dzone', [F(45, 30), F(45, 55), D(25, 32), D(25, 53), X(70, 42.5), X(55, 10), X(55, 75), X(15, 65), G(14, 42.5)], []),
  },
  {
    name: '3-on-2 Zone Entry Options',
    category: 'tactics',
    description: 'Three forwards attack two defenders from the red line. Work on the three entry options: drive wide and delay, middle drive, and the drop pass.',
    duration: 10,
    intensity: 'high',
    age_levels: MID,
    focus_areas: ['neutral-zone'],
    skills: ['decision-making', 'hockey-iq', 'puck-skills'],
    coaching_points: ['Attack with width — three lanes', 'Puck carrier makes the D commit', 'Middle lane drives the net'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('ozone', [F(110, 15), F(110, 42.5), F(110, 70), D(140, 30), D(140, 55), G(186, 42.5), puck(112, 16)], [ln('carry', [110, 15], [150, 15]), ln('skate', [110, 42.5], [170, 42.5]), ln('skate', [110, 70], [160, 68])]),
  },
  {
    name: 'D-Zone Faceoff Plays',
    category: 'tactics',
    description: 'Set plays off defensive-zone draws: win back to the strong-side D, wingers tie up, exit up the wall. Practise both wins and losses.',
    duration: 8,
    intensity: 'low',
    age_levels: OLDER,
    focus_areas: ['d-zone', 'breakout'],
    skills: ['positioning', 'hockey-iq'],
    coaching_points: ['Centre: win it back to the D', 'Wingers: tie up your man immediately', 'On a loss — get to your coverage assignment'],
    equipment: ['Pucks'],
    diagram: dia('dzone', [F(31, 64.5, 'C'), X(34, 64.5), F(31, 77), F(38, 50), D(18, 62), D(22, 42), puck(32, 64.5)], [ln('pass', [32, 64.5], [19, 62])]),
  },
  {
    name: 'Corner Puck Battles 1-on-1',
    category: 'conditioning',
    description: 'Coach rims a puck into the corner; two players battle for possession and try to score. 20–30 second shifts.',
    duration: 8,
    intensity: 'high',
    age_levels: MID,
    focus_areas: ['individual', 'd-zone'],
    skills: ['compete', 'puck-skills'],
    coaching_points: ['Low centre of gravity, wide base', 'Protect the puck with your body', 'Win the race — first three strides'],
    equipment: ['Pucks', 'Net', 'Goalie'],
    diagram: dia('dzone', [F(40, 60), X(40, 70), C(60, 80), G(14, 42.5), puck(10, 78)], [ln('pass', [60, 80], [12, 78])]),
  },
  {
    name: 'Cross-Ice 3-on-3 Small-Area Game',
    category: 'conditioning',
    description: 'Small-area game in one zone with two nets. 45-second shifts, puck must be passed before shooting. Builds compete, decision-making and puck protection under pressure.',
    duration: 12,
    intensity: 'high',
    age_levels: ALL,
    focus_areas: ['individual', 'neutral-zone'],
    skills: ['compete', 'decision-making', 'hockey-iq', 'puck-skills'],
    coaching_points: ['Support the puck carrier — get open', 'Quick shifts, high tempo', 'Shoot from anywhere, crash the net'],
    equipment: ['Pucks', '2 Nets'],
    diagram: dia('ozone', [F(150, 25), F(160, 50), F(140, 60), X(155, 35), X(145, 50), X(170, 65), puck(150, 27)], []),
  },
  {
    name: 'Full-Ice Flow Tempo Drill',
    category: 'conditioning',
    description: 'Continuous full-ice flow: players pass with the D, skate the length of the ice and finish with a shot, then immediately join the next rush from the other end.',
    duration: 10,
    intensity: 'high',
    age_levels: MID,
    focus_areas: ['neutral-zone'],
    skills: ['skating', 'puck-skills', 'shooting'],
    coaching_points: ['Pace — game speed throughout', 'Passes on the tape, in stride', 'Finish every rep with a shot on net'],
    equipment: ['Pucks', '2 Nets', 'Goalies'],
    diagram: dia('full', [F(30, 70), D(60, 50), G(14, 42.5), G(186, 42.5), puck(30, 72)], [ln('pass', [30, 70], [60, 50]), ln('skate', [30, 70], [100, 75], [150, 60]), ln('pass', [60, 50], [150, 58]), ln('shot', [150, 58], [186, 44])]),
  },
  {
    name: 'Cool-Down & Stretch',
    category: 'conditioning',
    description: 'Easy skate followed by a team stretch at centre ice. Use the time for a quick recap of the practice objectives.',
    duration: 5,
    intensity: 'low',
    age_levels: ALL,
    focus_areas: [],
    skills: [],
    coaching_points: ['Recap the 1–2 key teaching points', 'Hip flexors, groin and hamstrings'],
    equipment: [],
    diagram: null,
  },
];

// ---------------------------------------------------------------------------
// Systems library
// ---------------------------------------------------------------------------
export interface LibrarySystem {
  name: string;
  category: string;
  summary: string;
  key_points: string[];
  steps: { title: string; body: string; diagram: Diagram | null }[];
}

export const LIBRARY_SYSTEMS: LibrarySystem[] = [
  {
    name: '1-2-2 Forecheck',
    category: 'forecheck',
    summary: 'A conservative, structured forecheck: one forward pressures and steers the puck to one side while two forwards and two D sit higher to clog the walls and the middle. Great for teams learning forecheck structure or protecting a lead.',
    key_points: ['F1 steers, does not chase', 'F2/F3 take away the walls', 'D hold the blue line only when support is in place', 'Turn pucks over in the neutral zone, not deep'],
    steps: [
      {
        title: 'Set-up as the puck goes deep',
        body: 'F1 goes in on an angle toward the puck carrier. F2 and F3 position at the top of the circles, inside the dots. Both D are at the blue line, ready to step up on wall plays.',
        diagram: dia('ozone', [F(172, 55, 'F1'), F(158, 22, 'F2'), F(158, 63, 'F3'), D(128, 25), D(128, 60), X(185, 62), X(180, 25), puck(186, 64)], [ln('skate', [172, 55], [182, 62])]),
      },
      {
        title: 'Steer the puck to the wall',
        body: 'F1 approaches from the middle, forcing the D to move the puck up the strong-side boards. Stick in the passing lane to the D partner.',
        diagram: dia('ozone', [F(178, 58, 'F1'), F(158, 22, 'F2'), F(156, 70, 'F3'), D(128, 25), D(130, 66), X(186, 66), X(170, 78), puck(186, 66)], [ln('pass', [186, 66], [171, 78]), ln('skate', [156, 70], [166, 76])]),
      },
      {
        title: 'Squeeze the strong side',
        body: 'Strong-side F (F3) closes on the winger receiving on the wall; strong-side D pinches only if F2 has rotated to cover the point. Weak-side players shift across to protect the middle.',
        diagram: dia('ozone', [F(176, 66, 'F1'), F(140, 35, 'F2'), F(166, 76, 'F3'), D(128, 40), D(140, 74), X(170, 79), X(150, 50), puck(170, 79)], [ln('skate', [158, 22], [140, 35]), ln('skate', [130, 66], [140, 74])]),
      },
    ],
  },
  {
    name: '2-1-2 Aggressive Forecheck',
    category: 'forecheck',
    summary: 'Two forwards attack deep to create turnovers in the offensive zone, with the third forward high in the slot and the D ready to pinch. High-reward, high-risk — needs fast, disciplined forwards.',
    key_points: ['F1 hits the puck carrier, F2 takes the next option', 'F3 is the safety valve in the high slot', 'Pinch on wall plays — F3 covers the point'],
    steps: [
      {
        title: 'Two deep',
        body: 'F1 attacks the puck carrier. F2 reads the first pass option (D-to-D or behind the net) and attacks it. F3 sits in the high slot.',
        diagram: dia('ozone', [F(180, 55, 'F1'), F(172, 30, 'F2'), F(150, 42.5, 'F3'), D(128, 20), D(128, 65), X(186, 62), X(184, 22)], [ln('skate', [180, 55], [185, 60]), ln('skate', [172, 30], [182, 24])]),
      },
      {
        title: 'Pinch and recover',
        body: 'When the puck goes up the wall, the strong-side D pinches. F3 rotates to the vacated point. The weak-side D slides to the middle of the blue line.',
        diagram: dia('ozone', [F(182, 60, 'F1'), F(178, 30, 'F2'), F(132, 65, 'F3'), D(150, 76), D(128, 42.5), X(160, 78)], [ln('skate', [128, 65], [150, 76]), ln('skate', [150, 42.5], [132, 65])]),
      },
    ],
  },
  {
    name: 'Strong-Side Wall Breakout',
    category: 'breakout',
    summary: 'The foundational breakout: D retrieves, moves the puck to the strong-side winger on the wall, who bumps to the swinging centre or chips out. Simple, reliable and the base for every other breakout.',
    key_points: ['Winger on the wall at the hash marks, stopped and facing the play', 'Wingers stay in the zone until possession is secured', 'Centre supports low', 'Weak-side winger provides a middle-lane option'],
    steps: [
      {
        title: 'Retrieval',
        body: 'D1 retrieves with a shoulder check. D2 goes to the front of the net / opposite post and communicates ("wheel", "over", "reverse", "up"). Strong-side winger gets to the wall at the hash marks.',
        diagram: dia('dzone', [D(10, 62, 'D1'), D(18, 40, 'D2'), F(34, 80, 'W'), F(36, 50, 'C'), F(36, 8, 'W'), X(45, 62), puck(8, 66)], [ln('skate', [36, 50], [30, 60])]),
      },
      {
        title: 'Up the wall',
        body: 'D1 passes up the strong-side wall. The winger receives on the forehand with feet stopped, ready to make a play. The centre swings low into support.',
        diagram: dia('dzone', [D(10, 66, 'D1'), D(18, 40, 'D2'), F(34, 80, 'W'), F(38, 66, 'C'), F(40, 20, 'W'), X(45, 62), puck(10, 66)], [ln('pass', [10, 66], [32, 79]), ln('skate', [30, 60], [38, 66])]),
      },
      {
        title: 'Exit',
        body: 'Winger bumps to the centre in motion or chips past the pinching D. Weak-side winger is in the middle lane above the circle — NOT at the far blue line — as a second option.',
        diagram: dia('dzone', [F(34, 80, 'W'), F(50, 70, 'C'), F(55, 35, 'W'), D(25, 60), D(25, 30), X(60, 72)], [ln('pass', [34, 80], [48, 71]), ln('carry', [50, 70], [80, 65]), ln('skate', [40, 20], [55, 35])]),
      },
    ],
  },
  {
    name: 'Reverse Breakout',
    category: 'breakout',
    summary: 'Used when the forechecker takes away the strong side: D1 skates the puck behind the net and reverses it back to D2, who exits on the weak side.',
    key_points: ['D2 reads and calls "reverse"', 'Use the net as a screen against F1', 'Weak-side winger must be on the wall early'],
    steps: [
      {
        title: 'Read the forecheck',
        body: 'F1 is pressuring hard from the strong side. D2 calls "reverse" and positions low on the opposite side of the net.',
        diagram: dia('dzone', [D(12, 62, 'D1'), D(14, 25, 'D2'), X(28, 62), F(34, 6, 'W'), puck(10, 64)], [ln('carry', [12, 62], [6, 48])]),
      },
      {
        title: 'Reverse and exit',
        body: 'D1 rims or passes the puck back behind the net to D2. D2 moves it up the weak-side wall to the winger.',
        diagram: dia('dzone', [D(6, 48, 'D1'), D(12, 24, 'D2'), X(16, 55), F(34, 6, 'W'), puck(6, 46)], [ln('pass', [6, 46], [12, 26]), ln('pass', [12, 24], [33, 7])]),
      },
    ],
  },
  {
    name: 'Box +1 Zone Coverage',
    category: 'd-zone',
    summary: 'A zone-based defensive-zone structure: the two D and two wingers form a box, the centre supports low. Protects the slot and keeps everyone responsible for an area.',
    key_points: ['Protect the house (slot) first', 'Strong-side D pressures the puck carrier low', 'Centre supports the D down low', 'Wingers cover the points — sticks in lanes'],
    steps: [
      {
        title: 'Puck in the corner',
        body: 'Strong-side D pressures the puck carrier. Centre supports low. Weak-side D protects the net front. Wingers sit high, between the dots and the points.',
        diagram: dia('dzone', [D(14, 70), D(20, 45), F(25, 60, 'C'), F(55, 22), F(55, 63), X(10, 76), X(30, 80), X(70, 20), X(70, 65), X(30, 42), G(14, 42.5), puck(10, 78)], []),
      },
      {
        title: 'Puck at the point',
        body: 'Strong-side winger closes on the point shot, weak-side winger collapses to the slot. D tie up sticks in front.',
        diagram: dia('dzone', [D(18, 50), D(20, 38), F(30, 60, 'C'), F(60, 22), F(66, 60), X(72, 64), X(22, 46), G(14, 42.5), puck(72, 66)], [ln('skate', [55, 63], [66, 60]), ln('skate', [55, 22], [42, 35])]),
      },
    ],
  },
  {
    name: '1-3-1 Neutral Zone Forecheck',
    category: 'neutral-zone',
    summary: 'A neutral-zone system that clogs the middle and forces the opponent wide. One forward steers, three players form a wall across the red line, and the last defender stays deep.',
    key_points: ['F1 forces play to one side', 'Middle three move as a connected unit', 'Deep D never gets beat behind'],
    steps: [
      {
        title: 'Set the shell',
        body: 'F1 at the top of the opponent’s circles steering the puck. F2, F3 and one D spread across the red line. The other D sits at our blue line.',
        diagram: dia('full', [F(140, 42.5, 'F1'), F(100, 15), F(100, 42.5), D(100, 70), D(72, 42.5), X(165, 30), X(165, 55), puck(167, 31)], []),
      },
      {
        title: 'Squeeze the wall',
        body: 'When the puck goes to the wall, the strong-side player attacks and the rest of the unit shifts over to trap the carrier against the boards.',
        diagram: dia('full', [F(135, 25, 'F1'), F(110, 12), F(100, 35), D(95, 58), D(75, 35), X(120, 8), puck(121, 9)], [ln('skate', [100, 15], [110, 12])]),
      },
    ],
  },
  {
    name: '1-3-1 Power Play (Umbrella)',
    category: 'power-play',
    summary: 'The most common power-play formation: one D at the top, two flanks on the half-walls, a bumper in the middle and a net-front player. Creates a passing triangle on either side of the penalty killers.',
    key_points: ['Move the puck quickly to shift the box', 'Bumper in the soft middle', 'Net-front screens and wins rebounds', 'Shots create chances — get pucks to the net'],
    steps: [
      {
        title: 'Formation',
        body: 'Point D at the top centre, flanks on each half-wall around the hash marks, bumper between the circles, net-front player on the goalie’s eyes.',
        diagram: dia('ozone', [D(132, 42.5), F(162, 12), F(162, 73), F(152, 42.5, 'B'), F(181, 46), X(158, 30), X(158, 55), X(176, 32), X(176, 55), G(186, 42.5), puck(134, 43)], []),
      },
      {
        title: 'Flank, bumper, shot',
        body: 'Point to flank; the flank looks to the bumper or a one-timer from the weak side. Net-front screens on the shot.',
        diagram: dia('ozone', [D(132, 42.5), F(162, 12), F(162, 73), F(152, 42.5, 'B'), F(181, 46), G(186, 42.5)], [ln('pass', [132, 42.5], [161, 14]), ln('pass', [162, 12], [151, 41]), ln('shot', [152, 42.5], [186, 43])]),
      },
    ],
  },
  {
    name: 'Box Penalty Kill',
    category: 'penalty-kill',
    summary: 'Four killers form a box to protect the slot, forcing shots from the outside. Pressure is applied on bobbled pucks and bad touches.',
    key_points: ['Keep the box tight — protect the middle', 'Sticks in seam lanes', 'Pressure on bobbles', 'Clear the puck when you win it — no fancy plays'],
    steps: [
      {
        title: 'Box set-up',
        body: 'Two forwards high between the dots and the points, two D low protecting the net front.',
        diagram: dia('dzone', [F(45, 30), F(45, 55), D(25, 34), D(25, 51), X(70, 42.5), X(55, 10), X(55, 75), X(15, 65), X(30, 42), G(14, 42.5), puck(70, 43)], []),
      },
      {
        title: 'Rotate with the puck',
        body: 'When the puck moves to the half-wall, the strong-side forward pressures and the box rotates. Weak-side forward drops to the slot.',
        diagram: dia('dzone', [F(52, 66), F(40, 40), D(22, 52), D(22, 36), X(55, 75), X(15, 65), G(14, 42.5), puck(55, 76)], [ln('skate', [45, 55], [52, 66]), ln('skate', [45, 30], [40, 40])]),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Coaching education library
// ---------------------------------------------------------------------------
export interface LibraryResource {
  category: string;
  title: string;
  summary: string;
  body: string;
  tips: string[];
  level: string;
  diagram?: Diagram | null;
}

export const LIBRARY_RESOURCES: LibraryResource[] = [
  {
    category: 'skating',
    title: 'The Forward Stride: Teaching Full Extension',
    summary: 'Break down the forward stride into push, extension and recovery so players skate faster with less effort.',
    level: 'All ages',
    body: `## Why it matters
Skating is the foundation every other skill sits on. A player with an efficient stride arrives first, stays balanced in battles and has more time to make decisions.

## The three phases
- **Push:** the blade pushes out to the side (not straight back) at roughly 45°, driving through the whole blade from heel to toe.
- **Extension:** the pushing leg fully extends — knee and ankle — finishing with a toe flick.
- **Recovery:** the leg returns under the body quickly, ready for the next push. Players often skip this and end up "running" on the ice.

## Body position
Knees bent so the knee is over the toe, chest up, eyes forward. Arms swing forward and back, not across the body.

## Common errors
- Short, choppy strides with no extension
- Standing too upright, which shortens the push
- Arms swinging side to side, which pulls the shoulders out of line

## Progression
Start with stationary push-and-hold drills along the boards, then one-foot glides, then full-length stride ladders. Finish with races to keep it competitive.`,
    tips: ['Use "push to the side, not the back" as the cue', 'Film players from behind — extension errors are obvious', 'Make skating competitive with relay races'],
  },
  {
    category: 'skating',
    title: 'Edges and Crossovers: Building Agility',
    summary: 'Inside and outside edge work is what separates agile skaters. A progression from basic edges to game-speed crossovers.',
    level: 'U9 – U15',
    body: `## Inside and outside edges
Every turn, cut and crossover depends on edge control. Teach players to feel both edges of each skate before adding speed.

## Progression
1. **Two-foot edges:** slalom between cones on two feet.
2. **One-foot edges:** inside-edge C-cuts, then outside-edge C-cuts on each foot.
3. **Crossovers:** start stationary around a circle, then add pace. The under-leg push is the power — the crossover step is just recovery.
4. **Transitions:** forward-to-backward pivots and mohawks at the top of the circle.

## Coaching cues
- "Knee over toe" for deep edges
- "Push with the under-leg" on crossovers
- "Eyes where you want to go"

## Age considerations
Edges are best developed between ages 6 and 12, when motor learning is fastest. Older players benefit from edge-work warm-ups every practice.`,
    tips: ['Add a puck once edges are solid', 'Use the circles — they are free cones', 'Challenge: fewest crossovers to complete a lap'],
  },
  {
    category: 'offensive-skills',
    title: 'Shooting: The Quick Release',
    summary: 'In modern hockey, release speed matters more than shot power. How to teach catch-and-release shooting.',
    level: 'U13+',
    body: `## Release beats power
Goalies are bigger and better positioned than ever. The shooter who releases before the goalie is set scores more than the shooter with the hardest slap shot.

## Key elements
- **Receive in shooting position:** weight on the back foot, puck slightly behind the front foot.
- **Change the angle:** pull the puck in toward the body before releasing to change the goalie's sightline.
- **Short follow-through:** point the blade at the target.

## Drill ideas
- Catch-and-release lanes (one touch to shoot)
- Three-shot rapid fire
- Shooting off the pass while moving laterally

## Common errors
Taking an extra stickhandle before shooting, looking down at the puck, and shooting for the goalie's crest instead of corners.`,
    tips: ['Count "one-thousand" — shot must be gone before you finish', 'Pick a target before receiving the pass', 'Reward goals scored in under one second'],
  },
  {
    category: 'offensive-skills',
    title: 'Puck Protection Fundamentals',
    summary: 'Teach players to use their body, stick and skates to keep possession under pressure.',
    level: 'All ages',
    body: `## Principles
- Keep your body between the defender and the puck.
- Wide base, low centre of gravity.
- Puck on the far side, away from the defender's stick.
- Use your free arm (legally) to feel the defender and create space.

## Situations
- **Along the boards:** turn your back to pressure, keep the puck in your skates, look for support.
- **Below the goal line:** use the net as a shield.
- **In open ice:** shoulder-check before receiving so you know where pressure is coming from.

## Progressions
Start with 1-on-1 "keep away" in a small area, then add a target (pass to a teammate or shoot), then add a second defender.`,
    tips: ['Small areas = more reps', 'Short battles (20–30 s) keep intensity high', 'Reward protection, not just goals'],
  },
  {
    category: 'defensive-skills',
    title: 'Gap Control for Defencemen',
    summary: 'How to close space on attackers, match speed and steer them to the outside.',
    level: 'U13+',
    body: `## What gap control is
Gap is the distance between the defender and the puck carrier. A tight gap takes away time and space; a loose gap gives the attacker options.

## The steps
1. **Close early:** skate forward toward the attacker while support is in place.
2. **Pivot and match speed:** turn backwards with the attacker, roughly a stick-length away.
3. **Inside-out:** stay between the attacker and the middle of the ice.
4. **Steer and finish:** push the attacker wide, then close with body position or stick check.

## Reading the play
Close the gap when the attacker's head is down, when the puck is bobbled, or when they are skating laterally. Back off when they have speed and a support option.`,
    tips: ['"Stick on puck, body on body"', 'Never let the attacker get to the inside', 'Practise against forwards with speed'],
  },
  {
    category: 'defensive-skills',
    title: 'Angling: Taking Away Time and Space',
    summary: 'Angling teaches checkers to force puck carriers into low-danger areas using approach paths rather than chasing.',
    level: 'All ages',
    body: `## The concept
Angling is approaching the puck carrier on a curved path so they only have one way to go — usually toward the boards. It is the foundation of forechecking and backchecking.

## Teaching points
- Approach from the inside so the middle is taken away.
- Stick in the passing lane first, then body.
- Do not over-skate the carrier — control your speed.
- Finish against the boards (age-appropriate contact).

## Where it shows up
Forechecking (F1 steering the puck), defensive-zone coverage (strong-side D) and backchecking (pinning the carrier against the wall).`,
    tips: ['Use cones to show the curved approach', 'Walk it first, then half speed, then live', 'Connect to your forecheck system'],
  },
  {
    category: 'team-systems',
    title: 'Teaching Breakouts: Why Wingers Leave Early',
    summary: 'The most common breakout breakdown at minor and junior levels — and how to fix it.',
    level: 'U13+',
    body: `## The problem
Wingers anticipate the breakout and leave the defensive zone before the puck is secured. The D has no outlet, the centre is isolated, and the puck is turned over in the most dangerous area of the ice.

## Why it happens
- Wingers want to get a head start on offence.
- They do not trust the D to win the race to the puck.
- They have not been taught where to stand or when to leave.

## The fix
1. **Clear rule:** "We leave the zone together, with the puck."
2. **Position:** strong-side winger stopped on the wall at the hash marks, facing the play.
3. **Shoulder-check:** know where pressure is before the puck arrives.
4. **Weak-side winger:** support in the middle lane, above the circle.

## Practice plan idea
Open with wall-support walkthroughs, progress to D-to-wing rim-and-bump timing, then 5-man breakouts against a forechecker. Finish with a small-area game that rewards clean exits.

## Measuring progress
Log breakout observations in every game. If turnovers on exits trend down over 3–4 games, the habit is sticking.`,
    tips: ['Freeze the drill when a winger leaves early', 'Praise wingers who hold the wall', 'Show game video when available'],
  },
  {
    category: 'team-systems',
    title: 'Choosing a Forecheck for Your Team',
    summary: 'How to pick between a 1-2-2, 2-1-2 or 2-3 forecheck based on your players, age group and game situation.',
    level: 'U15+',
    body: `## Start with your players
- **Fast, aggressive forwards:** a 2-1-2 creates turnovers deep.
- **Developing or smaller teams:** a 1-2-2 keeps structure and reduces odd-man rushes.
- **Mobile D:** allow more pinching.

## Game situation
Protecting a lead calls for a conservative 1-2-2. Trailing late, switch to a 2-1-2 and pinch aggressively.

## Teaching tips
Teach one forecheck well before adding a second. Players need clear roles: who pressures (F1), who reads (F2), who is the safety (F3).`,
    tips: ['One system mastered beats three half-learned', 'Name your systems so you can call them from the bench', 'Practise transitions from forecheck to backcheck'],
  },
  {
    category: 'hockey-iq',
    title: 'Scanning: Teaching Players to Shoulder-Check',
    summary: 'Elite players scan before receiving. Shoulder-checking is a teachable habit that dramatically improves decision-making.',
    level: 'All ages',
    body: `## What scanning is
Looking over the shoulder before the puck arrives to see pressure, teammates and space. Players who scan make faster, better decisions because they already know their options.

## How to build the habit
- Add a "check" cue to drills: coach holds up fingers behind the player, who must call the number before receiving.
- Reward scans in small-area games.
- Freeze plays and ask "what did you see?"

## Connecting to games
Breakout errors and turnovers in the neutral zone often come from players receiving the puck without knowing where pressure is. Log these observations to track improvement.`,
    tips: ['Coach-call numbers are fun and fast', 'Scan twice: once early, once just before the puck', 'Ask questions instead of giving answers'],
  },
  {
    category: 'hockey-iq',
    title: 'Games-Based Learning',
    summary: 'Use small-area games to develop decision-making, creativity and compete — not just skills in isolation.',
    level: 'All ages',
    body: `## Why games work
Drills teach technique; games teach players when and why to use it. Small-area games give more puck touches, more decisions and more battles per minute than full-ice drills.

## Designing a good game
- Constrain the space to increase pressure.
- Add rules that force the behaviour you want ("must pass before shooting", "goal counts double off a rebound").
- Keep shifts short (30–45 seconds).

## Coaching during games
Let the game be the teacher. Stop play sparingly, ask questions, and let players solve problems.`,
    tips: ['Change one rule to change the focus', 'Keep score — compete matters', 'Use games as the reward at the end of practice'],
  },
  {
    category: 'practice-design',
    title: 'Building a 60-Minute Practice',
    summary: 'A simple structure for planning efficient, high-tempo practices with a clear objective.',
    level: 'All ages',
    body: `## Structure
1. **Warm-up (5–8 min):** skating with progressive intensity.
2. **Skill block (15–20 min):** 2–3 drills on individual skills linked to the objective.
3. **Team concept (15–20 min):** systems or tactical work, progressing from walkthrough to live.
4. **Compete (10–12 min):** small-area game or battle drill that reinforces the objective.
5. **Cool-down (3–5 min):** stretch and recap.

## Principles
- One main objective per practice.
- Explain drills off-ice or with a diagram — not at the whiteboard for five minutes.
- Aim for players moving 75%+ of the time.
- Use stations to increase reps.

## Connect practice to games
Choose the objective based on what you saw in the last game and what your development priorities are.`,
    tips: ['Plan transitions between drills', 'Have pucks and cones set before players arrive', 'Name one teaching point per drill'],
  },
  {
    category: 'practice-design',
    title: 'Station-Based Practices',
    summary: 'Splitting the ice into stations increases reps and engagement, especially for younger players.',
    level: 'U9 – U13',
    body: `## Why stations
Full-ice drills with long lines mean players stand more than they skate. Stations divide the ice into 3–4 areas so every player is active.

## Setting up
- One coach per station where possible.
- Rotate every 6–8 minutes on the whistle.
- Make each station focus on one skill: skating, puck handling, shooting, small-area game.

## Tips
Keep instructions short and demonstrate. Have a parent volunteer or older player help run a station if you are short-staffed.`,
    tips: ['Whistle rotation keeps pace high', 'Same station layout every week saves time', 'Put the goalie coach at the shooting station'],
  },
  {
    category: 'player-development',
    title: 'Running Effective Player Evaluations',
    summary: 'How to evaluate players consistently and turn evaluations into development plans.',
    level: 'All ages',
    body: `## Be consistent
Use the same categories and rating scale every time. In BenchIQ you can customise categories per team; a 1–5 scale works well:
- 1 — needs significant work
- 2 — developing
- 3 — competent
- 4 — strong
- 5 — elite for the level

## Evaluate regularly
Preseason, mid-season and end-of-season at minimum. Short monthly check-ins help track progress.

## Turn it into action
- Pick 1–2 development goals per player.
- Link goals to drills the player will see in practice.
- Share strengths first, then areas to improve.

## Communicate
Players and parents respond best to specific, behaviour-based feedback: "You're holding the wall on breakouts more consistently" beats "good job".`,
    tips: ['Rate what you saw, not potential', 'Write one concrete example per rating', 'Revisit goals every 4–6 weeks'],
  },
  {
    category: 'player-development',
    title: 'Long-Term Player Development by Age',
    summary: 'What to emphasise at each stage, from first strides to high-performance hockey.',
    level: 'All ages',
    body: `## U7 – U9: FUNdamentals
Skating, balance, agility and puck control through games. Cross-ice formats, lots of puck touches.

## U11: Learning to train
Skill acquisition window. Edges, passing, shooting technique, introduction to positional concepts. Keep it fun and games-based.

## U13: Training to train
Refine skills at speed. Introduce team concepts: basic breakouts, forecheck roles, defensive-zone responsibilities. Body-contact skills (angling, positioning).

## U15 – U16: Training to compete
Systems become more detailed. Physical development accelerates — strength, conditioning and recovery matter. Decision-making under pressure.

## U18+: Training to win
Specialised roles, advanced systems, video review, and individual performance plans.`,
    tips: ['Match practice content to the stage, not the schedule', 'Skill windows close — prioritise them early', 'Late developers are common — keep doors open'],
  },
  {
    category: 'leadership',
    title: 'Communicating with Players on the Bench',
    summary: 'Short, specific, positive bench communication that players can act on during the next shift.',
    level: 'All ages',
    body: `## Keep it short
Players coming off a shift are tired. One sentence, one teaching point.

## Be specific
"Stop on the wall at the hash marks" is actionable. "Be better on breakouts" is not.

## Balance
Aim for more positive than corrective feedback. Recognise good habits immediately — especially the ones you are working on in practice.

## Save the big stuff
Detailed corrections belong in practice or video review, not on the bench in the middle of a game.`,
    tips: ['Use the same language as in practice', 'Talk to players at eye level', 'Let assistants handle specific position groups'],
  },
  {
    category: 'leadership',
    title: 'Building Team Culture and Leadership',
    summary: 'Practical ways to develop leaders and a positive, accountable team culture.',
    level: 'U13+',
    body: `## Set expectations early
Agree on team standards in the first week: effort, punctuality, respect, communication. Write them down.

## Develop leaders
Rotate responsibilities (leading warm-ups, collecting pucks, speaking at meetings) so more players develop leadership skills — not just the captain.

## Accountability
Hold everyone to the same standards. Address issues privately and quickly.

## Parents
Communicate the season plan and development philosophy at a preseason parent meeting.`,
    tips: ['Leadership groups of 3–5 players work well', 'Celebrate effort, not just results', 'Hold short check-ins with leaders weekly'],
  },
];
