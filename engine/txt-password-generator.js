(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};

/* The passphrase words: written for this site, see build/wordlist/README.txt. */
/* WORDS-START (build/gen-passphrase-words.js) */
const PW_WORDS = (
  'aardvark abandon abbey ability able abode abolish abroad abrupt absence absent absolve absorb absurd abundant ' +
  'acacia accent accept access accord accordion account accuracy accuse ache achieve acid acorn acquire acre ' +
  'acrobat across action active actor actual acute adam adamant adapt added adder address adept adequate adhere ' +
  'adjourn adjust admiral admire admired admit adobe adopt adorable adult advance advantage adventure advice ' +
  'advise advocate aerial affair affect afflict afford afraid africa after again agent aggregate agile agitate ' +
  'agree agreement ahead airplane airy aisle alarm albatross album alder alert alice alien alike alive alkali ' +
  'alley alligator allocate allow alloy allude almond almost alone along alpha alphabet alpine alps also altar ' +
  'alter aluminium always amaze amazon amber ambition ambulance amend amiable amount ample amplify amuse amused ' +
  'amusement analyse analysis ancestor anchor anchovy ancient andes andy angel anger angle angler angry angular ' +
  'animal ankle anklet anna annex annie announce annoy annual answer anteater antelope anthem antique antler ' +
  'anvil anxiety anxious anyone apart apollo apology appeal appear appetite applaud applause apple apply appoint ' +
  'appraise approach approve apricot april apron arabic arbor arcade arch archer archery architect arctic ardent ' +
  'area arena argue argument arid arise armadillo armchair armor armpit army aroma around arrange arrest arrival ' +
  'arrive arrow artful arthur artichoke artist artwork ascend ashen asia aside asleep asparagus aspect aspen ' +
  'assemble assert asset assign assist assume assure asteroid astonish astronaut astute athena atlantic atlas ' +
  'atom atomic attach attack attain attempt attend attic attitude attract auburn auction audience audio audit ' +
  'augment august aunt aurora austere australia author authorise auto autumn avalanche avenge avenue average avid ' +
  'avocado avoid await awake awaken award aware awareness away awful awhile awkward axis axle azalea azure baboon ' +
  'baby back backpack backup bacon badge badger badly badminton bagel baggy bagpipe bait bake baker bakery ' +
  'balance balcony bald balkans ball ballad ballet balloon balmy baltic bamboo banana band bandana bandit banish ' +
  'banjo bank banker banner banquet banyan baobab barber bare bargain barge barista bark barley barn barnacle ' +
  'baron barrel barren barrier barter basalt base baseball basement bashful basic basil basin basis basket bass ' +
  'baste batch bath bathe bathroom baton battery battle bauble bazaar beach beacon bead beads beak beam bean ' +
  'beanbag beanie bear beard beast beat beauty beaver beckon become bedeck bedroom beech beef beekeeper beep beet ' +
  'beetle beetroot before beget begin behave behind behold beige being belief bell bella bellow belly belong ' +
  'beloved below belt bench bend benefit benign benzene berlin berry beside best bestow betray better bewilder ' +
  'beyond bible bicker bicycle bike bikini bill bind binder bingo biology birch bird birth birthday biscuit ' +
  'bisect bishop bismuth bison bitter black blade blame blanch bland blank blanket blast blaze blazer blazing ' +
  'bleach bleak blend bless blessing blind blinds blink bliss blissful blithe blizzard block blond blonde blood ' +
  'bloom blossom blouse blue bluebell blueberry bluebird bluff blunt blur blush bluster board boast boat boatman ' +
  'bobcat body boil bold bolero bolster bolt bombard bond bone bonfire bongo bonsai bonus bony book bookcase ' +
  'bookend bookmark boom boost boot border boredom boring borneo borrow boss bossy botanist both bottle bottom ' +
  'bough boulder bounce bouncy bound boundary bowl bowling bowman boxing brace bracelet braces bracket brain ' +
  'brake bramble branch brand brandish brash brass brave bravery brazen brazil bread breadth break breath breed ' +
  'breeze brew brewer bribe brick bride bridge brief brier bright brilliant brim bring brisk bristle britain ' +
  'brittle broach broad broccoli brochure broke bronze brooch brook broom brother brow brown brownie browse ' +
  'bruise brush bubble bubbly bucket buckle buddy budge budget buff buffalo bugle build builder bulb bulk bull ' +
  'bumblebee bump bunch bundle bunny burden bureau burgundy burly burn burrow burst bury bush business bustle ' +
  'bustling busy butcher butler butter buttercup butterfly button buzz buzzard cabbage cabbie cabin cabinet cable ' +
  'cactus cadet cafe cage cairo cajole cake calcium calculate calendar calf call calm camel camellia camera camp ' +
  'campaign campfire camping canada canal canary cancan candid candle candy cane canoe canter canvas canyon ' +
  'capacity cape capital captain capture caramel caravan carbon card cardboard cardigan cards career carefree ' +
  'careful caress cargo caribou carl carnation carnival carol carousel carpenter carpet carrot carry cart carton ' +
  'carve cascade case cash cashew cashier caspian cassette castigate castle casual catalogue catch cater cattle ' +
  'cause caution cautious cave cavern cavort cedar ceiling celebrate celery cell cellar cello cement census cent ' +
  'centaur center centipede century ceramic cerberus cereal ceremony cerise certain certainty chain chair chalice ' +
  'chalk challenge chameleon champ champion chance change channel chant chaos chapel chapter character charade ' +
  'charcoal charge chariot charity charm chart chase chat chatter chauffeur cheap check checkers cheddar cheek ' +
  'cheer cheerful cheese cheetah chef chemist chemistry cheque cherish cherry chess chest chestnut chew chick ' +
  'chickadee chicken chide chief child chile chili chill chilly chime chimera chimney chin china chip chipmunk ' +
  'chirpy chisel chivalry chive chocolate choice choir choose chop chord chorus chrome chubby chuckle chunk ' +
  'church churn cicada cider cigar cinder cinema cinnamon circle circuit circulate circus citadel cities citizen ' +
  'citrus city civic civil claim clam clamber clamp clap clara clarify clarinet clarity clash clasp class classic ' +
  'classroom claw clay clean cleanse clear clerk clever cliff climate climb cling clinic clip clipboard clipper ' +
  'cloak clobber clock cloister close closet closure cloth clothing cloud clover clown club clue clump clumsy ' +
  'cluster clutch coach coal coarse coast coat coax cobalt cobbler cobra cobweb cockatoo cocoa coconut code ' +
  'coffee cogent coil coin cola cold collapse collar collect college colony color colossal column comb combine ' +
  'combo comedy comet comfort comfy comic command commence commend comment commerce committee common community ' +
  'compact company compare compass compel compile complaint complete complex compose compound compress conceal ' +
  'concede conceive concept concern concert concise conclude condense condition condor conduct cone confer ' +
  'confess confide confirm conflict conform confront confuse conga congo connect conquer consent conserve ' +
  'consider console constrict consult consume contact contain contend content contest context contort contract ' +
  'contrast control convene convert convey convince cook cookbook cooker cookie cope copper copy cora coral cord ' +
  'cordial core coriander cork cormorant corn corner cornmeal correct corrode corset corsica cosmic cosmos cost ' +
  'costume cosy cottage cotton couch cougar cough counsel count counter country couple coupon courage course ' +
  'court courtesy courtly cousin cove cover cowboy cower coyote cozy crab crackers crackle cradle craft crafty ' +
  'cram cranberry crane crash crate crater cravat crave crawl crayon crazy cream crease create creation creature ' +
  'credit creek creep crescent crest crete crew cricket crimson crisis crisp criterion critic crocodile crooked ' +
  'crop croquet cross crossbow crossword crouch crouton crow crowbar crowd crowded crown crude cruel cruise ' +
  'cruiser crumb crumble crunch crusader crush crust crystal cuba cube cuckoo cucumber cuddle cuddly cuff ' +
  'culminate cultivate culture cupboard curator curb curdle cure curiosity curious curl curling curly currant ' +
  'current curry curtail curtain curve curvy cushion custard custom cute cutter cyan cycle cycling cyclone ' +
  'cyclops cymbal cypress cyprus czech dabble daffodil dagger dahlia daily dainty dairy daisy dale dally damage ' +
  'damp dampen dana dance dancer dandelion dandy danger dangle danish danube dapper dare daring dark dart darts ' +
  'dash dashing data date daughter david dawdle dawn dazzle dazzling deal dear debate debris debt decade decant ' +
  'decay december decent decide decision deck declare decline decor decorate decrease dedicate deduce deed deep ' +
  'deer defeat defence defend defer defiant define deflect deform defrost degree delay delegate delete delhi ' +
  'delicate delight delirious deliver delta deluge demand demeter demolish denim denote dense density dental ' +
  'dentist deny depart departure depend depict deplete deploy deposit depot depth deputy derive descend desert ' +
  'deserve design designer desire desk despise destiny detach detail detect deter develop device devise devote ' +
  'devotion devour devout dial dialogue diamond diana diary dice diesel diet differ diffuse digest digit dignity ' +
  'dilute dime dimension diminish dine dinghy dingo dingy dinner diploma direct direction dirt disarm disaster ' +
  'disc discard discern disco discover discovery discus discuss disguise dish dislike dismal dismiss display ' +
  'dispose dispute dissolve distance distant distil distort distract disturb ditch dive diver diverge diversity ' +
  'divert divide divine diving division divulge dizzy docile dock doctor dodge dodgeball dogwood doll dollar ' +
  'dolphin domain dome domino dominoes donate donkey donor doodle door doorbell doorknob doormat dora dormant ' +
  'dose double doubt doubtful doughnut dove dover dowel down downpour doze dozen drab draft drag dragon dragonfly ' +
  'drain drama drape draughts draw drawer dream dreamy dreary drench dress dresser drift drill drink drip drive ' +
  'drizzle droopy drop drought drown drowsy druid drum drummer dryad dublin duck duckling duet duke dull dumpling ' +
  'dune dungeon dusk dusky dust duster dusty dutch duty dwarf dwell dwindle eager eagle earl early earmuffs earn ' +
  'earnest earring earth earthworm earthy ease easel east easy eavesdrop ebony echo eclipse economy edgar edge ' +
  'edit edith editor educate education eerie effect effort eggplant egret egypt eight either elapse elastic ' +
  'elated elbow elder elect election electron elegant element elephant elevate elicit eligible elite ella else ' +
  'elude elusive elven emanate embark embassy embed ember emblem embrace emerald emerge emergency eminent emit ' +
  'emma emotion emperor emphasis empire employ empower empress empty enable enact enamel enchant enclose encode ' +
  'encounter encourage endless endorse endure enemy energy engage engine engineer england english engrave enhance ' +
  'enjoy enlarge enlist enormous enough enrich enrol ensue ensure entail enter entice entire entrance entrust ' +
  'entry envelop envelope envious envision envoy envy enzyme epic equal equality equinox equip equipment ' +
  'eradicate erase eraser erect erode eros error erupt escalate escape escort essay essence estate estimate ' +
  'estuary eternal ethan ethic ethical euro europe evade evaluate evan evaporate even event ever everest ' +
  'evergreen every evict evidence evil evoke evolution evolve exact exalt exam examine example exceed excel ' +
  'excess exchange excite excited exclaim exclude excuse exercise exert exhale exhibit exhort exile exist ' +
  'existence exit exotic expand expansion expect expel expert explain explode exploit explore explorer export ' +
  'expose exquisite extend extent extra extract exude eyebrow eyelid fable fabled fabric fabricate face fact ' +
  'factor factory faculty fade faded failure faint fair fairness fairy faith faithful fake falcon falconer fall ' +
  'fallen false falter fame famed familiar family famous fancy fantastic fantasy faraway farm farmer fashion fast ' +
  'fasten fatal fate father fathom faucet fault favor favour fawn fear feast feather feature february fedora ' +
  'feeble feed feel feeling feisty fellow felt fence fencing fennel fern ferret ferry fertile fest fester ' +
  'festival festive fetch fever fiber fickle fiction fiddle fiddler fidelity fidget fief field fierce fiery fight ' +
  'figure figurine fiji file fill film filter filthy final finance finch find fine finger finish finland finn ' +
  'finnish fire firefly fireplace fireworks firm first fish fisher fishing fist five fizz fizzle fjord flag flaky ' +
  'flame flamingo flannel flap flare flash flashy flask flat flatter flaunt flavor flawed flax flee fleet flesh ' +
  'flick flicker flight flimsy flinch fling flint flinty flip float flock flood floor floppy florid florist ' +
  'flounder flour flourish flow flower fluctuate fluent fluff fluffy fluid flush flute flutter flyer foam focus ' +
  'foggy foil fold folder foliage folk follow fond fondle font food fool foolish foot football foothill forage ' +
  'forbid force forearm forecast forehead forest forester forge forget forgive fork form formal formula formulate ' +
  'fort fortify fortress fortunate fortune forum forward fossil foster found fountain foxglove foxtrot fracture ' +
  'fragile fragment frail frame france frank frantic freckled fred free freedom freeze freezer freighter french ' +
  'frequent fresh friday fridge friend friendly frigid frilly fringe frisky frog frolic front frost frosty frown ' +
  'frozen frugal fruit fruity fuchsia fudge fuel full fumble function fund funky funnel funny furnace furnish ' +
  'furry fury fusion fussy futile future gadget gaia gail gain gala galaxy gale gallant gallery gallon gallop ' +
  'galvanise gamble game ganges garage garden gardener gardenia gargoyle garland garlic garner garnet gary gate ' +
  'gateway gather gathering gaudy gauge gavel gavotte gaze gazelle gear gecko gender gene generate geneva genius ' +
  'gentle genuine geologist geometry geranium gerbil german gesture geyser ghost giant gibbon giddy gift gifted ' +
  'gigantic giggle gilded ginger ginkgo giraffe girl give glacier glad glance gland glare glass glazier gleam ' +
  'gleaming glean glen glide glider glimpse glisten gloat globe gloom gloomy glorify glorious glory glossy glove ' +
  'gloves glow glower glue glum gnome goal goat gobble goblet goblin gold golden goldfish goldsmith golf gondola ' +
  'gone gong good goose gopher gorge gorgeous gorilla gospel gossip govern gown grab grace graceful gracious ' +
  'grade graduate graft grain grand grandma granite granola grant grape graph graphite grapple grasp grass ' +
  'grateful gratify gratitude gravel gravity gravy gray graze greasy great greece greedy greek green greenland ' +
  'greet greta grid grief griffin grill grim grimace grin grind grinder grip grit gritty groan grocer groom ' +
  'groove groovy grouchy ground group grouse grove grow growl grown growth gruff grumble grumpy guarantee guard ' +
  'guava guess guest guidance guide guild guilty guinea guitar guitarist gulf gull gullible gully guppy gust ' +
  'gusty guzzle gymnast gypsum habit haddock hades haggle hail hair hairy haiti halberd half hall hallow hallway ' +
  'halo halt hammer hammock hamper hamster hand handbag handle handsome handy hanger hank hannah happy harbor ' +
  'harbour hard hardy hare harm harmless harmonica harmony harness harp harpoon harry harsh harvest hasten hasty ' +
  'hatch hatchet hatter haul haunt have haven hawaii hawk hawthorn hazard haze hazel hazelnut hazy head headband ' +
  'heal health healthy heap hear heart hearth hearty heat heater heather heave heavy hebrew hedge hedgehog heel ' +
  'hefty height heighten helen helios helium helmet help helpful hemlock henry hera herald herb herd herder ' +
  'heritage hermes hermit hero heron herring hesitate hibernate hickory hidden hide high highland highlight hike ' +
  'hiking hilarious hill himalaya hinder hindi hinge hint hippo hire history hive hoard hobby hockey hoist hold ' +
  'hole holiday hollow holly holy home homework honest honesty honey honor honour hood hoodie hoof hook hope ' +
  'hopeful horizon hormone horn hornet horrid horse hospital host hostel hotdog hotel hound hour hourglass house ' +
  'hover howl huddle hudson huge hugo humble humid humor humour hunger hungry hunt hunter hurdle hurricane hurry ' +
  'hurt husband hush husky hustle hutch hyacinth hybrid hydra hydrogen hyena hymn hypnotise ibex ibis icarus ' +
  'iceberg iceland icicle icing icon idea ideal identity idle idol idolise igloo ignite ignore iguana illusion ' +
  'image imagine imitate immense immerse impact impala impart impede impish implore imply import impose impress ' +
  'imprint improve improvise impulse incense inch incite incline include income incur index india indicate indigo ' +
  'induce indulge industry inertia infant infer inferno inflate inflict influence inform inhabit inhale inherit ' +
  'inject injury inland inner innocent input inquire inquiry insect insert inside insight insist inspect inspire ' +
  'install instance instinct instruct insulate insurance intact integrity intend intense intention interact ' +
  'interest interfere interior interpret interrupt interval intervene introduce invade invent invention inverse ' +
  'invest invite invoice invoke iran iraq ireland iris iron irrigate isaac island isle isolate isotope israel ' +
  'issue isthmus italian italy item ivan ivory jack jackal jacket jade jaded jagged jaguar jail jamaica jane ' +
  'jangle janitor january japan japanese jasmine jason jasper jaunty java javelin jazz jazzy jealous jean jeans ' +
  'jeep jelly jellyfish jenny jersey jester jewel jeweller jigsaw jingle jive joan john join joiner joke jolly ' +
  'jordan josh jostle joule journal journey joust joyful joyous judge judgement judo judy juggle juggler juggling ' +
  'juice juicy julia july jumble jumbo jump jumper jumpy june jungle junior juniper junk juno jupiter jury just ' +
  'justice justify kale kangaroo karate kate kayak kayaking keen keep keeper kelly kenya kernel ketchup kettle ' +
  'keychain khaki kick kidney kiln kilt kimono kind kindle kindness king kingdom kingly kiosk kiss kitchen kite ' +
  'kitten kiwi knapsack knead knee kneel knickers knight knit knitting knob knobby knock knoll knot knotty know ' +
  'knowledge known knuckle koala korean kraken kyle kyoto label labor labour lace lack lacrosse ladder ladle lady ' +
  'ladybug lagoon lake lamb lame lament lamp lance land landscape lane language lanky lantern lapel lara larder ' +
  'large lark lasagne laser last lasting latch late lathe latin laugh laughter launch launder laura laurel lava ' +
  'lavender lavish lawful lawn lawyer layer lazy lead leaf leaflet leafy league leak lean leap learn lease ' +
  'leather leave lecture lecturer ledge left legacy legal legend leggings legislate leisure lemming lemon lemur ' +
  'lend length lengthen lens lentil leopard lesson lethal letter lettuce level lever levitate liar liberate ' +
  'liberty librarian library license licorice life lifeboat lifeguard lifetime lift light lighter lightning ' +
  'likely lilac lily limb limbo lime limestone limit limo limp linda linden line linen liner linger link lion ' +
  'liquefy liquid lisa lisbon list listen lithe lithium litter little live lively liver livid lizard llama load ' +
  'loaf loan loathe lobby lobster local location lock locker locket locksmith locust lodge loft lofty logic ' +
  'loiter lola lollipop london lone lonely long longing look loon loop loose loosen lord lorry lose lost lottery ' +
  'lotus loud lounge love lovely loving loyal loyalty lubricate luck lucky lucy luke lumber lumpy lunar lunch ' +
  'lunchbox lung lurch lure lurk lush lusty lute luxury lydia lynx lyre lyric macaroni macaw mace machine ' +
  'machinery mackerel madam madrid mage magenta magic magician magma magnet magnify magnitude magnolia magpie ' +
  'mahjong mahogany maid maiden mail main maintain major majority make male malice mall mallard mallet malta mama ' +
  'mambo mammal mammoth manage manatee mandolin mandrill mango mangrove mannequin manner manoeuvre manor mansion ' +
  'mantel mantle many maple marathon marble marbles march margin marigold marimba marinate marine mark marked ' +
  'marker market marmot maroon marriage mars marsh marvel mary marzipan mascot mask mason mass massive master ' +
  'match mate material math matter mattress mature mauve maybe mayor mazurka meadow meager meal mean meander ' +
  'meaning measure meat meatball meaty mechanic medal meddle media mediate medicine meditate medusa meerkat ' +
  'megaphone mellow melodic melody melon melt member memo memory mend mental mention mentor menu merchant mercury ' +
  'mercy mere merge meringue merit merry mesa mesh mess message messy metal meteor meter method mexico mica ' +
  'microwave middle midnight midwife might mighty migrate migration mike mila milan mild mile military milk mill ' +
  'miller millet mimic mincemeat mind mine miner mineral mingle minibus minimise minister mink minnow minor ' +
  'minority minotaur minstrel mint minty minuet minute miracle mirror mirthful miser mislead miss mission mist ' +
  'mistletoe misty mitten mittens mixture moat mobile mobilise model modern modest modify moist moisten molar ' +
  'molasses mole molecule moment momentum monarch monastery monday money mongoose monitor monk monkey monocle ' +
  'monopoly monsoon month monthly monument mood moody moon moonbeam moor moose moped moral morality more morning ' +
  'mortgage mosaic moscow mosque mosquito moss mossy most moth mother motion motley motor motorbike mound mount ' +
  'mountain mouse mouth move movement movie much muddle muddy muffin muffle muffler mule multiply mumble mummy ' +
  'munch mundane murky murmur muscle muse museum mushroom music musical musician mustard muster mute mutter ' +
  'mutual myrtle mystery mystic myth nail naive name nancy napkin narrative narrow narwhal nation native natural ' +
  'nature naughty navel navigator navy near neat nebula necessity neck necklace necktie nectar need needle needy ' +
  'neighbour neil neon nepal nephew neptune nerve nervous nest nestle netball nettle network neuron neutron never ' +
  'newt next nibble nice nick nickel niece nifty night nightgown nile nimble nina nine nitrogen noah noble noise ' +
  'noisy nomad nominate none noodle noon nora normal norse north norway nose nosy notch note notebook notepad ' +
  'notice notion nourish novel november nucleus nudge nugget nuisance numb number nurse nursery nurture nutmeg ' +
  'nutty nylon nymph oaken oasis oatmeal obese obey object oblige oblong oboe observe obtain obvious occasion ' +
  'occupy ocean ocelot ochre octave october octopus odin offend offer offering office offset often ogre oily okay ' +
  'olden oleander olga olive oliver olympus omar omega omelette omit once onion online only onset onto onyx ooze ' +
  'opal open opera operate opinion opium opossum oppose optician option oracle orange orangutan orbit orchard ' +
  'orchid order orderly ordinary oregano organ organise orient origin originate oriole orion ornament ornate ' +
  'orphan oscar oscillate oslo osprey ostrich other otter ought ounce outback outcome outer outline output oval ' +
  'oven over overall oversee overtake owen owner oxide oxygen oyster ozone pace pacific pacify pack package ' +
  'paddle padlock page pageant pagoda pain paint paintbox painter painting pair pajamas palace paladin pale ' +
  'palette palm paltry pamper pamphlet pancake panda panel panic pansy panther pantry pants papaya paper paprika ' +
  'parachute parade paradise parakeet parasol parcel pardon parent paris park parka parlour parrot parsley ' +
  'parsnip part particle partridge party pass passage passport past pasta paste pastel pastor pastry patch path ' +
  'patient patio patrol pattern paul pause pavilion payment peace peaceful peach peacock peak peanut pear pearl ' +
  'pebble pecan pedal peel peer pegasus pelican pelt penalty pencil pendant pendulum penetrate penguin peninsula ' +
  'penny peony people pepper peppy perceive perch perfect perform perfume period perish perky permit persist ' +
  'person perspire persuade pert peru pervade pester petal peter petite petty petunia pewter phase pheasant ' +
  'phoenix phone photo photon phrase physics pianist piano piccolo pick pickaxe pickle pickup picnic picture ' +
  'piece pier pierce pigeon pikeman pile pilfer pilgrim pillar pillow pilot pincers pinch pine pineapple pink ' +
  'pint pinwheel pioneer pious pipe pippa piranha pirouette pistachio pitch pitcher pivot pixel pizza place ' +
  'placid plain plait plan plane planet plank plant plaque plasma plaster plastic plate plateau platinum platter ' +
  'platypus play playful plaza plea plead pleasant pleasure pledge plenty pliers plod plot plover plow pluck ' +
  'plucky plug plum plumb plumber plume plummet plump plunder plunge plus plush plywood pocket poem poet poetic ' +
  'poetry point pointy poise poker poland polar pole polecat police policy polish polite politics polka polo ' +
  'polymer pompous poncho pond ponder pony pool poor popcorn poplar poppy porch porcupine porpoise porridge port ' +
  'portal porter portion portly portray portugal pose poseidon posh position possess possum post postcard poster ' +
  'postpone potato potent potential potter pottery pouch pounce pound pour poverty powder power practice practise ' +
  'prague prairie praise prance prawn pray preach precede predict prefer prepare prescribe presence present ' +
  'preserve preside press pressure prestige pretend pretty pretzel prevail prevent prey price pricey prickle ' +
  'prickly pride prim prime primrose prince princess principle print printer priority prism prison privacy prize ' +
  'probe proceed process proclaim procure produce professor profit program progress prohibit project prolong ' +
  'promise promote prompt proof prop propel proper property prospect prosper protect protest proton proud prove ' +
  'provide province provoke prowl prudent prune public publish publisher pudding puddle puff puffin puffy pull ' +
  'pulley pullover pulp pulsar pulse puma pumice pump pumpkin punch puncture punish pupil puppet puppy pure ' +
  'purple purpose purse pursue push pushy puzzle pyramid python quack quail quaint quake quality quantity quantum ' +
  'quarrel quarry quart quartz quasar quay queasy quebec queen queenly quench query quest question queue quiche ' +
  'quick quiet quill quilt quilting quinoa quirky quit quiver quiz quotation quote rabbit race rachel rack racket ' +
  'radar radiant radiator radio radish radium raft rage ragged rail rain rainbow raincoat rainy raise raisin rake ' +
  'rally ralph ramble rampage rampart ranch random range ranger ransack rapid rapids rare rascal rasp raspberry ' +
  'ratchet rate rather rattle ravage raven ravine razor reach reaction reactor read reading ready real reality ' +
  'realm reap reason rebel rebuild recall receipt receive recipe recital reckon recline recoil record recorder ' +
  'recount recover recovery recruit recycle redeem reduce redwood reed reef reel refer refine reflect reform ' +
  'refresh refuel refuge refund refuse regain regal regard regent region register regret regulate rehearse reign ' +
  'reindeer reinforce reject rejoice relate relation relax relay release relic relieve religion relish relocate ' +
  'rely remain remark remedy remember remind remodel remote remove render renew renounce renovate rent repair ' +
  'repay repeal repeat repel repent replace replenish replicate reply report reporter represent reproach request ' +
  'require rescue research resemble reserve reside resign resin resist resolve resort resource respect respond ' +
  'response rest restore restrain result retail retain retina retire retort retract retreat retrieve return ' +
  'reunion reunite reveal revel reverse review revise revive revolve reward rhine rhino rhubarb rhyme rhythm ' +
  'ribbon rice rich rick rickshaw ricochet riddle ride rider ridge right rigid ring rinse ripe ripen ripple rise ' +
  'risk risotto rita ritual rival river rivet road roam roar roast robe robin robot rock rocker rocket rodeo roll ' +
  'roman romance rome roof room roomy rooster root rope rosa rosary rose rosemary rosy rotate rotten rough ' +
  'roulette round route routine rover rowboat rowdy rowing royal rubber rubbery ruby rudder rude rugby rugged ' +
  'ruin rule ruler rumba rumble rummage rural rush russet russia russian rust rustle rusty ruth sabotage sack ' +
  'sacred sacrifice saddle safari safe safeguard safety saffron sage sahara sail sailboat sailing sailor saint ' +
  'salad salami salary salmon salon salsa salt salty salute salvage samba same sample sanction sanctuary sand ' +
  'sandal sander sandpiper sandwich sandy sane sapling sapphire sara sardine sarong sassy satchel satellite satin ' +
  'satisfy saturday saturn satyr sauce saucer saunter sausage savage savanna save saving savour saxophone scale ' +
  'scalp scaly scan scandal scarce scarecrow scarf scarlet scary scatter scene scenic scent scepter scheme ' +
  'scholar school science scissors scold scone scoop scooter scope scorch score scorpion scotland scout scrabble ' +
  'scramble scrap scrape scraper scratch scrawl scrawny scream screech screen screw scribble scribe script scroll ' +
  'scrub sculptor sculpture scurry seagull seahorse seal sean search season seat second secret section secure ' +
  'security sedate seduce seed seek seem seethe segment seize select selfish sell semolina senate send senior ' +
  'sensation sense sensor sentence sentry seoul separate sepia september sequence sequoia serenade serene serf ' +
  'series serious servant serve sesame session settle seven sever shabby shade shadow shady shaft shaggy shake ' +
  'shaky shale shallot shallow shame shape share shark sharp sharpener shatter shave shawl shed sheep sheet shelf ' +
  'shell shelter shepherd sherbet shield shift shilling shimmer shin shine shiny ship shirt shiver shock shocking ' +
  'shoe shoot shop shore short shorts shoulder shout shove shovel show shower showy shrew shrewd shrill shrimp ' +
  'shrine shrink shrub shudder shuffle shut shutter shuttle siberia sicily sick sickle side sideboard sidle siege ' +
  'sienna sight sign signal signpost silence silent silica silicon silk silky silly silver simmer simple simplify ' +
  'simulate sincere sing singe singer single sink siren sister sitar site situation size sizzling skate skating ' +
  'sketch sketching skiff skiing skill skim skin skinny skip skipper skirt skittles skull skunk slab slacken ' +
  'slacks slam slate sled sledding sleek sleep sleepy sleet sleeve sleigh slender slice slick slide slight slim ' +
  'slimy sling slip slipper slippery slither sloop slope slot sloth slow sluggish slumber slush small smart smash ' +
  'smell smile smiling smog smoggy smoke smooth smoulder smug smuggle snack snail snake snap snappy snatch sneak ' +
  'sneaker sneaky sneeze snicker sniff snooker snore snow snowman snowy snug snuggle soak soap soapy soar sober ' +
  'soccer social society sock soda sodium sofa soft softball soften soil solar soldier solemn solid solitaire ' +
  'solo solstice solution solve somber some song sonic soon soothe sooty sophie soprano sore sorrow sorry sort ' +
  'soul sound soup sour source south souvenir sovereign space spade spaghetti spain spanish spanner spare spark ' +
  'sparkle sparrow sparse spatula spawn speak spear special specify spectrum speech speed speedboat speedy spell ' +
  'spelling spend sphere sphinx spice spicy spider spiffy spike spiky spill spin spinach spindle spine spirit ' +
  'spit splash splatter splendour splinter split spoil sponge spooky spoon sport spot spotty spouse sprawl spray ' +
  'spread spring sprinkle sprint sprout spruce spry spur squall squander square squash squeaky squeeze squid ' +
  'squire squirrel stability stable stack stadium staff stag stage stagger stain stair stairs stake stale stammer ' +
  'stamp stampede stand standard staple stapler star stare starfish stark starlight start startle starve stash ' +
  'state stately statement static station statue status stay steady steak steam steel steep steer stella stem ' +
  'stencil step steppe steve stew stick sticker sticky stiff still stimulate sting stingray stingy stipulate stir ' +
  'stitch stock stocking stomach stone stool stoop stop stopwatch store stork storm stormy story stout stove ' +
  'straight strange strategy straw stray streak stream street strength stretch strict stride strike string strip ' +
  'stripe stroll strong structure struggle stubby student studio study stuff stumble stun sturdy style stylish ' +
  'suave subdue subject submarine submerge submit subside subtle suburb subway succeed success such sudan sudden ' +
  'sudoku suede suffice sugar sugary suggest suit suitcase sulphur summary summer summit summon sundae sunday ' +
  'sundial sundress sunflower sunny sunrise sunset sunshine super superb supernova supervise supper supplant ' +
  'supple supply support suppose suppress sure surf surface surfing surge surgeon surmount surpass surprise ' +
  'surrender surround survey surveyor survival susan sushi suspect suspend suspicion sustain swagger swahili ' +
  'swallow swamp swan swap swarm sway sweat sweater sweden swedish sweep sweet swell swerve swift swim swimming ' +
  'swimsuit swing swirl switch swivel sword sycamore sydney syllabus symbol symbolise symphony symptom syrup ' +
  'system table tack tackle tacky tadpole tahiti tail tailor take talc tale talent talented talk tall tame tamper ' +
  'tangerine tangle tango tangy tank tantalise tape tapestry tapir tara target tarnish tarot tart task tassel ' +
  'taste tasty tattered taunt taupe taut tavern tawny taxi teach teacher teacup teal team teapot tear tease teddy ' +
  'teen teeny teeth telescope tell temple tempt tenant tendency tender tennis tenor tense tension tent tepid term ' +
  'terminate termite tern terrace terse tess test testify text textbook thames thank thatcher thaw theatre theme ' +
  'theory thermos thick thicket thigh thimble thin thing think third thirsty thirty thistle thor thorn thorny ' +
  'thought thrash thread threat threaten three thrifty thrill thrive throat throb throne through throw thrush ' +
  'thumb thunder thursday thwart thyme tibet ticket tickle tide tidy tiger tight tighten tights tile tiler timber ' +
  'time tina tinker tinsel tiny tiptoe tire tired tissue titan titanium title toad toast toaster today toddle ' +
  'toddler tofu toga together toilet token tokyo tolerant tolerate toll tomato tombstone tonal tone tonga tongs ' +
  'tongue tonight tony tool toolbox tooth toothy topaz topic topple torch torment tornado torque torrid tortoise ' +
  'toss total tote totem totter toucan touch tough tour towel tower town trace track tracksuit tractor trade ' +
  'trader tradition tragedy tragic trail trailer train trainer training trait tram trample tranquil transfer ' +
  'transform translate transmit transport trap trapper trash travel traverse trawler tray treasure treat tree ' +
  'trek tremble trench trend trendy triangle tribe trick trickle tricky tricycle trifle trim trinket trio trip ' +
  'trite triton triumph trivia troll trolley trombone trophy trot trouble trousers trout trowel troy truck trudge ' +
  'true truffle trumpet trunk trust trusty truth tuba tube tuesday tugboat tulip tumble tuna tundra tune tungsten ' +
  'tunic tunnel turban turf turkey turkish turmeric turn turnip turquoise turret turtle tutor tuxedo tweezers ' +
  'twelve twice twiddle twig twilight twin twinkle twirl twist twisty type typhoon typist ukraine ukulele ultra ' +
  'umber umbrella uncle under undergo undermine undertake underwear undo uneven unfold unicorn uniform unify ' +
  'union unique unit unite unity universe unleash unlock unravel until unusual unveil upbeat uphold upon upper ' +
  'upright uproot upset urban urge urgency ursula usage useful usher usual utensil utilise utility utter vacant ' +
  'vacation vaccine vacuum vague vain valiant valid valley value valve vanilla vanish vapor variety vary vase ' +
  'vassal vast vault vector vehicle veil vein velvet velvety vendor venture venue venus vera verb verify verse ' +
  'version vessel vest veteran vibrant vibrate victimise victory video vienna view vigor viking villa village ' +
  'vince vindicate vine vinegar vineyard viola violet violin violinist viper virile virtual vise visible vision ' +
  'visit visor vital vitality vivid vocal voice volcano volt voltage volume vote vouch vowel voyage vulcan ' +
  'vulture wacky wade wafer waffle wage wager wagon wail waist waistcoat wait waiter wake wales walk walking wall ' +
  'wallaby wallet wallow walnut walrus walt waltz wand wander wane want warble warbler wardrobe warlock warm warn ' +
  'warning warrant warrior wary wash washer wasp waste wasteful watch water waterfall watery wave wavy weak ' +
  'weaken wealth wealthy wear weary weasel weather weave weaver wedding wedge wednesday week weekend weekly weigh ' +
  'weight weighty weird welcome welder welfare well welsh wendy west wetland whale wharf wheat wheel wheeze where ' +
  'whimper whimsical whip whippet whirl whirlwind whisk whisker whisper whist whistle white whittle whole wick ' +
  'wicked wide widen widow width wield wife wiggle wiggly wild wildcat will willing willow wily winch wind ' +
  'windchime windmill window windy wine wing winged wink winner winter wintry wipe wire wiry wisdom wise wish ' +
  'wishful wisteria witch withdraw wither withhold withstand witness witty wizard wobble wobbly wolf wolverine ' +
  'woman wombat wonder wonderful wood wooden woodwind wool woolly woozy word work worksheet workshop world ' +
  'worldly worm worn worry worship worth worthy wrangle wrap wreath wreck wren wrench wrestle wrestling wriggle ' +
  'wrinkly wrist write writer wrong xylophone yacht yara yard yarn yawn year yearly yearn yeast yell yellow ' +
  'yeoman yield yoga yogurt yolk young youth youthful yoyo yukon yummy zambia zany zealous zebra zenith zeppelin ' +
  'zero zest zesty zeus zigzag zinc zipper zither zodiac zone zoom zucchini zurich '
).trim().split(/\s+/);
/* WORDS-END */

/* ===== random numbers: crypto.getRandomValues only, no fallback ===== */
function pwHasCrypto() { return typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'; }
/* A uniform whole number from 0 to limit - 1. Rejection sampling keeps it unbiased: a 32-bit draw in the top
   slice that does not divide evenly by limit is drawn again. */
function pwRand(limit) {
  const max32 = 4294967296, bound = max32 - (max32 % limit);
  const buf = new Uint32Array(1);
  let v; do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= bound);
  return v % limit;
}
const pwLog2 = (x) => Math.log(x) / Math.LN2;
/* log2 of a BigInt, to full double precision */
function pwLog2Big(x) {
  const s = x.toString(2);
  const keep = Math.min(52, s.length);
  return (s.length - keep) + pwLog2(parseInt(s.slice(0, keep), 2));
}

/* ===== random characters ===== */
const PW_LOWER = 'abcdefghijklmnopqrstuvwxyz', PW_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', PW_DIGITS = '0123456789', PW_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';
function pwClasses(f) {
  const amb = f.ambiguous === 'include';
  const list = [];
  if (f.lower !== 'no') list.push(amb ? PW_LOWER : 'abcdefghijkmnopqrstuvwxyz');
  if (f.upper === 'yes') list.push(amb ? PW_UPPER : 'ABCDEFGHJKLMNPQRSTUVWXYZ');
  if (f.digits === 'yes') list.push(amb ? PW_DIGITS : '23456789');
  if (f.symbols === 'yes') list.push(PW_SYMBOLS);
  return list;
}
/* Strings of length n over the pool that use every class at least once: inclusion and exclusion over the classes */
function pwCoverCount(sizes, n) {
  const total = sizes.reduce((a, b) => a + b, 0);
  let count = 0n;
  for (let mask = 0; mask < (1 << sizes.length); mask++) {
    let left = total, bits = 0;
    for (let i = 0; i < sizes.length; i++) if (mask & (1 << i)) { left -= sizes[i]; bits++; }
    const term = BigInt(left) ** BigInt(n);
    count += bits % 2 ? -term : term;
  }
  return count;
}

/* ===== pronounceable: consonant, vowel, consonant, vowel … ===== */
const PW_CONS = 'bcdfghjkmnprstvwz', PW_VOW = 'aeiou';

/* ===== a typed password: how many guesses could it take? =====
   An estimate, and an optimistic one for the attacker's side of the sum: it knows a short list of the most common
   passwords, the passphrase words, sequences, repeats and keyboard rows, and otherwise assumes every character was
   chosen at random from the kinds of character it sees. A pattern it does not know is not credited. */
const PW_COMMON = ('123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football monkey letmein shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 superman 1qaz2wsx 7777777 121212 000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer harley batman andrew tigger sunshine iloveyou 2000 charlie robert thomas hockey ranger daniel starwars klaster 112233 george computer michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie 159753 aaaaaa ginger princess joshua cheese amanda summer love ashley nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder taylor matrix mobilemail mom monitor monitoring montana moon moscow welcome admin login passw0rd p@ssw0rd password1 password123 qwerty123 letmein1 welcome1 admin123 changeme default guest hello hello123 test test123 secret secret123 login123 abcd1234 iloveyou1 sunshine1 princess1 football1 monkey1 dragon1 master1 shadow1 qwertyui asdfghjkl qweasd 1q2w3e4r 1q2w3e 1qazxsw2 zaq12wsx 0987654321 11223344 123456a a123456 123abc abc123456 lovely flower butterfly whatever trustno 696969 passpass cookie jessica1 samantha nathan arsenal liverpool chelsea1 chocolate banana cheese1 coffee orange purple turtle hannah ginger1 summer1 winter1 spring autumn london1 america canada secret1 diamond ferrari hottie lakers marine peanut rainbow rocket tennis').split(/\s+/);
const PW_LEET = { '@': 'a', '4': 'a', '8': 'b', '3': 'e', '1': 'l', '!': 'i', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't' };
const PW_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'qazwsxedcrfvtgbyhnujmikolp'];
function pwSeqLen(s, i) {
  // the longest run starting at i whose characters go up or down by one, or repeat
  if (i + 2 >= s.length) return null;
  const d = s.charCodeAt(i + 1) - s.charCodeAt(i);
  if (d !== 0 && d !== 1 && d !== -1) return null;
  let j = i + 1;
  while (j + 1 < s.length && s.charCodeAt(j + 1) - s.charCodeAt(j) === d) j++;
  return j - i + 1 >= 3 ? { len: j - i + 1, kind: d === 0 ? 'repeat' : 'sequence' } : null;
}
function pwEstimate(pw) {
  const n = pw.length;
  if (!n) return null;
  const lower = pw.toLowerCase();
  const found = [];
  /* a common password, alone or with up to 4 digits or symbols after it, and with look-alike substitutions undone */
  const unleet = lower.replace(/[@48315!$07+]/g, (c) => PW_LEET[c]);
  const stripped = lower.replace(/[0-9!@#$%^&*._-]{1,4}$/, '');
  const stripped2 = unleet.replace(/[a-z]*$/, (m) => m).replace(/[0-9!@#$%^&*._-]{1,4}$/, '');
  for (const cand of [lower, stripped, unleet, stripped2]) {
    const k = PW_COMMON.indexOf(cand);
    if (k >= 0) {
      const extra = cand === lower ? 0 : (cand === stripped ? 1 + (n - stripped.length) * 3.3 : 2 + 3);
      return { bits: pwLog2(k + 1) + extra, found: ['one of the most common passwords' + (cand === lower ? '' : ' with a change or an ending'), 'rank ' + (k + 1) + ' in the built-in list of ' + PW_COMMON.length], kind: 'common' };
    }
  }
  /* made of the passphrase words: with capitals, look-alike swaps (0 for o, 4 for a …), digits and symbols between or
     after them. Each word costs log2 of the list; every digit or swap 3.3 bits, a symbol 5, a capital about 1. */
  const set = pwWordSet();
  /* a swap counts only between letters; a digit on an end stays a digit */
  const swapped = lower.replace(/[@48315!$07+]/g, (c, k) => (/[a-z]/.test(lower[k - 1] || '') && /[a-z]/.test(lower[k + 1] || '')) ? PW_LEET[c] : c);
  const known = (arr) => arr.length >= 1 && arr.every((w) => set.has(w) || PW_COMMON.indexOf(w) >= 0);
  let letters = lower.split(/[^a-z]+/).filter(Boolean);
  if (!known(letters)) letters = swapped.split(/[^a-z]+/).filter(Boolean);
  if (known(letters)) {
    const nonLetters = pw.replace(/[A-Za-z]/g, '');
    const digits = (nonLetters.match(/[0-9]/g) || []).length;
    const symbols = nonLetters.length - digits;
    const caps = (pw.match(/[A-Z]/g) || []).length;
    const bits = letters.length * pwLog2(PW_WORDS.length) + digits * 3.3 + symbols * 5 + Math.min(caps, letters.length + 1);
    const extras = [digits ? digits + ' digit' + (digits > 1 ? 's' : '') : '', symbols ? symbols + ' symbol' + (symbols > 1 ? 's' : '') : '', caps ? 'capitals' : ''].filter(Boolean);
    return { bits: bits, found: [letters.length + (letters.length === 1 ? ' word' : ' words') + ' from this tool\'s own list of ' + PW_WORDS.length.toLocaleString('en-GB') + (extras.length ? ', with ' + extras.join(' and ') : '')], kind: 'words' };
  }
  /* otherwise chunk it: sequences and repeats are cheap, every other character costs the pool it is drawn from */
  const hasL = /[a-z]/.test(pw), hasU = /[A-Z]/.test(pw), hasD = /[0-9]/.test(pw), hasS = /[ -\/:-@\[-`{-~]/.test(pw), hasO = /[^\x00-\x7F]/.test(pw);
  const pool = (hasL ? 26 : 0) + (hasU ? 26 : 0) + (hasD ? 10 : 0) + (hasS ? 33 : 0) + (hasO ? 100 : 0);
  let bits = 0, i = 0;
  while (i < n) {
    const sq = pwSeqLen(pw, i);
    if (sq) { bits += pwLog2(pool) + pwLog2(sq.len) + 1; found.push(sq.len + ' characters in a ' + sq.kind + ' (' + pw.slice(i, i + sq.len) + ')'); i += sq.len; continue; }
    let row = null;
    for (const r of PW_ROWS) { let k = 0; while (i + k < n && r.indexOf(lower[i + k]) >= 0 && r.indexOf(lower[i + k]) === r.indexOf(lower[i]) + k) k++; if (k >= 4 && (!row || k > row)) row = k; }
    if (row) { bits += pwLog2(pool) + pwLog2(row) + 2; found.push(row + ' characters along a keyboard row (' + pw.slice(i, i + row) + ')'); i += row; continue; }
    bits += pwLog2(pool);
    i++;
  }
  if (!found.length) found.push('no pattern found: counted as ' + n + ' characters drawn at random from ' + pool);
  return { bits: bits, found: found, kind: 'brute', pool: pool };
}
let PW_SET = null;
function pwWordSet() { return PW_SET || (PW_SET = new Set(PW_WORDS)); }

const PW_RATES = [
  ['Online, with a limit of about 100 guesses an hour', 100 / 3600],
  ['Online, no limit, 1,000 guesses a second', 1e3],
  ['Offline, slow hash (bcrypt or Argon2), 10,000 a second', 1e4],
  ['Offline, fast hash (MD5 or SHA-1), a trillion a second', 1e12]
];
function pwHuman(sec) {
  if (sec < 1) return 'under a second';
  const u = [['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400], ['year', 31557600], ['thousand years', 31557600e3], ['million years', 31557600e6], ['billion years', 31557600e9]];
  let k = 0;
  while (k + 1 < u.length && sec >= u[k + 1][1]) k++;
  const v = sec / u[k][1];
  if (v >= 1e6 * 1e3 && k === u.length - 1) return (v / 1e3).toExponential(1).replace('e+', ' × 10^') + ' trillion years';
  const n = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return n.toLocaleString('en-GB') + ' ' + u[k][0] + (n !== 1 && !/years$/.test(u[k][0]) ? 's' : '');
}
const PW_LEVELS = [[28, 'Very weak', 'under 28 bits'], [36, 'Weak', '28 to 35 bits'], [60, 'Fair', '36 to 59 bits'], [80, 'Strong', '60 to 79 bits'], [1e9, 'Very strong', '80 bits or more']];

window.TEXT_TOOLS["password-generator"] = {
"title": "Password Generator",
"kind": "generate",
"filename": "passwords.txt",
"download": {"ext": "txt", "type": "text/plain"},
"autosave": false,
"description": "Generate strong random passwords, passphrases and pronounceable passwords with a cryptographic random source, with exact entropy, or check how strong the one you use is.",
"keywords": ["password generator","strong password","random password","passphrase generator","secure password","password strength checker","pronounceable password"],
"regenerate": true,
"share": ["type","length","words","lower","upper","digits","symbols","ambiguous","cover","sep","caps","addnum","count"],
"fields": [
  {"key":"type","label":"Type","type":"select","default":"password","options":[{"value":"password","label":"Random characters"},{"value":"passphrase","label":"Passphrase (memorable words)"},{"value":"pronounce","label":"Pronounceable"},{"value":"check","label":"Check a password"}]},
  {"key":"length","label":"Length (characters)","type":"number","default":20,"min":6,"max":128},
  {"key":"words","label":"Words (passphrase)","type":"number","default":5,"min":3,"max":12},
  {"key":"lower","label":"Lowercase a-z","type":"select","default":"yes","options":[{"value":"yes","label":"Include"},{"value":"no","label":"Exclude"}]},
  {"key":"upper","label":"Uppercase A-Z","type":"select","default":"yes","options":[{"value":"yes","label":"Include"},{"value":"no","label":"Exclude"}]},
  {"key":"digits","label":"Digits 0-9","type":"select","default":"yes","options":[{"value":"yes","label":"Include"},{"value":"no","label":"Exclude"}]},
  {"key":"symbols","label":"Symbols","type":"select","default":"yes","options":[{"value":"yes","label":"Include"},{"value":"no","label":"Exclude"}]},
  {"key":"ambiguous","label":"Lookalike characters (l, 1, O, 0)","type":"select","default":"exclude","options":[{"value":"exclude","label":"Exclude"},{"value":"include","label":"Include"}]},
  {"key":"cover","label":"At least one of each kind","type":"select","default":"yes","options":[{"value":"yes","label":"Guarantee"},{"value":"no","label":"Do not force"}]},
  {"key":"sep","label":"Between words","type":"select","default":"-","options":[{"value":"-","label":"Hyphen"},{"value":" ","label":"Space"},{"value":".","label":"Full stop"},{"value":"_","label":"Underscore"},{"value":"","label":"Nothing"},{"value":"digit","label":"A random digit"}]},
  {"key":"caps","label":"Capital letters","type":"select","default":"one","options":[{"value":"none","label":"None"},{"value":"one","label":"One random word"},{"value":"each","label":"Every word"},{"value":"all","label":"All capitals"}]},
  {"key":"addnum","label":"Number on the end (0-99)","type":"select","default":"yes","options":[{"value":"yes","label":"Add"},{"value":"no","label":"Leave out"}]},
  {"key":"count","label":"How many","type":"number","default":5,"min":1,"max":50},
  {"key":"typed","label":"Password to check","type":"password","default":"","remember":false}
],
"generate": (f) => {
      if (!pwHasCrypto() && f.type !== 'check') {
        return { error: 'This browser has no cryptographic random source (crypto.getRandomValues), so no password was made. Use a current browser.' };
      }
      /* the cracking time: half the possibilities on average, at a trillion guesses a second */
      const crackTime = (entropy) => {
        const years = Math.pow(2, entropy) / (1e12 * 31557600);
        return years < 1 / 31557600 ? 'under a second'
          : years < 1 ? `${Math.round(years * 31557600).toLocaleString('en-GB')} seconds`
          : years < 1e6 ? `${Math.round(years).toLocaleString('en-GB')} years`
          : `${(years / 1e6).toExponential(1)} million years`;
      };

      if (f.type === 'check') {
        const pw = String(f.typed || '');
        if (!pw) return { output: '', warn: 'Type or paste a password above. It is checked in this page and never stored or sent.' };
        const e = pwEstimate(pw);
        const lvl = PW_LEVELS.find((l) => e.bits < l[0]);
        const lines = ['Estimated strength: about ' + Math.round(e.bits) + ' bits, about 2^' + Math.round(e.bits) + ' guesses.', '', 'What the estimate found:'].concat(e.found.map((x) => '  - ' + x));
        lines.push('', 'Average time to guess it, if the attacker tries guesses at these rates (half the possibilities):');
        PW_RATES.forEach((r) => lines.push('  ' + r[0] + ': ' + pwHuman(Math.pow(2, e.bits) / 2 / r[1])));
        lines.push('', 'These rates are assumptions, not predictions. Names, dates and phrases of your own are not recognised, so a password made of them is weaker than shown: treat the estimate as the best case.');
        return {
          output: lines.join('\n'),
          stats: [['Length', String(Array.from(pw).length) + ' characters'], ['Estimated strength', Math.round(e.bits) + ' bits'], ['Rating', lvl[1]], ['Offline cracking time*', crackTime(e.bits)]],
          meter: { bits: e.bits, level: PW_LEVELS.indexOf(lvl), label: lvl[1], band: lvl[2] },
          lang: null
        };
      }

      const n = Math.max(1, Math.min(50, Number(f.count) || 1));
      const out = [];
      let poolSize = 0, entropy = 0, poolLabel = '';
      const rules = [];

      if (f.type === 'passphrase') {
        const w = Math.max(3, Math.min(12, Number(f.words) || 5));
        const sep = f.sep === undefined ? '-' : f.sep;
        for (let i = 0; i < n; i++) {
          let parts = Array.from({ length: w }, () => PW_WORDS[pwRand(PW_WORDS.length)]);
          if (f.caps === 'each') parts = parts.map((x) => x.replace(/^./, (c) => c.toUpperCase()));
          else if (f.caps === 'all') parts = parts.map((x) => x.toUpperCase());
          else if (f.caps === 'one' || f.caps === undefined) {
            /* One word, picked once, gets a capital. Two separate draws here once copied a capitalised word
               over a different one, so a word appeared twice and another vanished. */
            const k = pwRand(w);
            parts[k] = parts[k].replace(/^./, (c) => c.toUpperCase());
          }
          let p = '';
          parts.forEach((x, k) => { p += x; if (k < w - 1) p += sep === 'digit' ? String(pwRand(10)) : sep; });
          if (f.addnum !== 'no') p += (sep === 'digit' || sep === '' ? '' : sep) + pwRand(100);
          out.push(p);
        }
        poolSize = PW_WORDS.length;
        poolLabel = ' words';
        entropy = w * pwLog2(PW_WORDS.length) + (f.addnum !== 'no' ? pwLog2(100) : 0) + (f.sep === 'digit' ? (w - 1) * pwLog2(10) : 0) + ((f.caps === 'one' || f.caps === undefined) ? pwLog2(w) : 0);
        rules.push(w + ' words from a list of ' + PW_WORDS.length.toLocaleString('en-GB'));
      } else if (f.type === 'pronounce') {
        const len = Math.max(6, Math.min(128, Number(f.length) || 20));
        for (let i = 0; i < n; i++) {
          let p = '';
          for (let k = 0; k < len; k++) p += k % 2 ? PW_VOW[pwRand(PW_VOW.length)] : PW_CONS[pwRand(PW_CONS.length)];
          if (f.upper === 'yes') { const k = pwRand(len); p = p.slice(0, k) + p[k].toUpperCase() + p.slice(k + 1); }
          if (f.digits === 'yes') p = p.slice(0, -1) + pwRand(10);
          out.push(p);
        }
        const consN = Math.ceil(len / 2), vowN = Math.floor(len / 2);
        entropy = consN * pwLog2(PW_CONS.length) + vowN * pwLog2(PW_VOW.length);
        if (f.digits === 'yes') entropy += pwLog2(10) - ((len - 1) % 2 ? pwLog2(PW_VOW.length) : pwLog2(PW_CONS.length));
        if (f.upper === 'yes') entropy += pwLog2(len);
        poolSize = PW_CONS.length + PW_VOW.length;
        poolLabel = ' letters, alternating consonant and vowel';
        rules.push('consonant, vowel, consonant, vowel …');
      } else {
        const classes = pwClasses(f);
        if (!classes.length) return { error: 'Choose at least one kind of character.' };
        const pool = classes.join('');
        const len = Math.max(6, Math.min(128, Number(f.length) || 20));
        const cover = f.cover !== 'no' && classes.length > 1;
        for (let i = 0; i < n; i++) {
          for (;;) {
            const p = Array.from({ length: len }, () => pool[pwRand(pool.length)]).join('');
            /* drawing again until every kind is present keeps every valid password equally likely */
            if (!cover || classes.every((c) => { for (const ch of p) if (c.indexOf(ch) >= 0) return true; return false; })) { out.push(p); break; }
          }
        }
        poolSize = pool.length;
        poolLabel = ' characters';
        entropy = cover ? pwLog2Big(pwCoverCount(classes.map((c) => c.length), len)) : len * pwLog2(pool.length);
        rules.push(cover ? 'at least one of each of the ' + classes.length + ' kinds' : 'no kind forced in');
      }

      return {
        output: out.join('\n'),
        stats: [
          ['Generated', String(n)],
          ['Entropy', `${Math.round(entropy)} bits`],
          ['Character pool', String(poolSize) + poolLabel],
          ['Rule', rules.join('; ')],
          ['Offline cracking time*', crackTime(entropy)],
          ['Random source', 'crypto.getRandomValues']
        ],
        warn: entropy < 60 ? 'Below about 60 bits of entropy is weak for anything that matters. Increase the length or add character types.' : ''
      };
    },
"tips": ["Length matters far more than complexity. A long passphrase of ordinary words beats a short string of symbols, and is easier to type on a phone.","Passwords are generated by your browser’s cryptographic random source and never transmitted. Nothing here is logged or stored.","Use a password manager and a different password everywhere. Reuse is what turns one breach into many.","*Cracking time assumes an offline attack at a trillion guesses per second against a fast hash. A properly slow hash such as Argon2 or bcrypt makes it vastly longer — but you cannot know which a given site uses.","Enable two-factor authentication wherever it is offered. It defeats a stolen password outright.","Check a password shows an estimate, with the guess rates it assumes. It runs in this page and nothing you type is kept or put in a link."],
"faq": [{"q":"Is generating a password in a browser safe?","a":"The randomness is sound — it uses the same cryptographic source as the browser’s own security features, and the page is static with no network calls. That said, a dedicated password manager generating directly into its vault removes the copy-paste step entirely, which is one fewer place for something to go wrong."},{"q":"Why exclude lookalike characters by default?","a":"Because l, 1, I, O and 0 are routinely misread when a password is written down or read aloud. Excluding them costs a few bits of entropy and saves a great deal of frustration."},{"q":"Where does the word list come from?","a":"It was written for this site and is not copied from the EFF, Diceware or any dictionary. Its size is shown in the Character pool row; the entropy is worked out from that size."}],
"mount": (ctx) => { const t = ctx.form.querySelector('#f-typed'); if (t) { t.type = 'password'; t.autocomplete = 'off'; t.spellcheck = false; t.setAttribute('data-lpignore', 'true'); } },
"render": function (res, ctx) { pwRender(res, ctx); }
};

function pwRender(res, ctx) {
  const f = ctx.fields();
  const keys = ['type', 'length', 'words', 'lower', 'upper', 'digits', 'symbols', 'ambiguous', 'cover', 'sep', 'caps', 'addnum', 'count', 'typed'];
  const wraps = ctx.form.querySelectorAll('.field');
  const t = f.type;
  const show = {
    type: true,
    length: t === 'password' || t === 'pronounce',
    words: t === 'passphrase',
    lower: t === 'password',
    upper: t === 'password' || t === 'pronounce',
    digits: t === 'password' || t === 'pronounce',
    symbols: t === 'password',
    ambiguous: t === 'password',
    cover: t === 'password',
    sep: t === 'passphrase',
    caps: t === 'passphrase',
    addnum: t === 'passphrase',
    count: t !== 'check',
    typed: t === 'check'
  };
  keys.forEach(function (k, i) { if (wraps[i]) wraps[i].hidden = !show[k]; });
  const box = ctx.extra;
  box.textContent = '';
  if (!res || !res.meter) return;
  const el = ctx.el;
  const m = res.meter;
  const wrap = el('div', 'io-pane pw-meter');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', 'Strength'));
  wrap.appendChild(head);
  const body = el('div', 'pw-meter-body');
  const bars = el('div', 'pw-bars');
  bars.setAttribute('role', 'img');
  bars.setAttribute('aria-label', m.label + ', about ' + Math.round(m.bits) + ' bits');
  for (let i = 0; i < 5; i++) bars.appendChild(el('span', 'pw-bar' + (i <= m.level ? ' on l' + m.level : '')));
  body.appendChild(bars);
  body.appendChild(el('div', 'pw-rate', m.label + ' · about ' + Math.round(m.bits) + ' bits (' + m.band + ' is rated ' + m.label.toLowerCase() + ')'));
  wrap.appendChild(body);
  box.appendChild(wrap);
}
})();
