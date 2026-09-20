/**
 * Seed charities. Illustrative organisations written for this build — not real
 * registered charities — so the directory has believable content without
 * implying any real body has endorsed the platform.
 */
export const charities = [
  {
    slug: 'first-tee-futures',
    name: 'First Tee Futures',
    tagline: 'Golf coaching and mentoring for teenagers who would never get a lesson otherwise.',
    category: 'Youth & education',
    region: 'National',
    impactHeadline: '1,240 young people coached last season',
    description:
      'First Tee Futures runs free weekly coaching at twenty-two municipal courses, pairing each young player with a volunteer mentor. The programme covers equipment, green fees and travel, so cost never decides who gets to play. Two thirds of participants are the first in their family to hold a club.',
    impactMetrics: [
      { label: 'Young players coached', value: '1,240' },
      { label: 'Volunteer mentors', value: '310' },
      { label: 'Courses hosting sessions', value: '22' },
    ],
    isFeatured: true,
    events: [
      { title: 'Summer Futures Open', venue: 'Rowan Park Golf Club', inDays: 34,
        description: 'A shotgun-start fundraiser where every entry pays for a term of coaching.' },
      { title: 'Mentor training weekend', venue: 'Harbrook Community Centre', inDays: 61 },
    ],
  },
  {
    slug: 'greenwood-dementia-trust',
    name: 'Greenwood Dementia Trust',
    tagline: 'Keeping people with early dementia outdoors, active and in company.',
    category: 'Health',
    region: 'North',
    impactHeadline: '96 weekly walking-golf groups',
    description:
      'Greenwood funds walking-golf groups designed for people living with early-stage dementia and the family members who care for them. Nine holes, no scorecard, a coffee afterwards. Clinicians on the programme report measurable improvements in mood and sleep among regular attenders.',
    impactMetrics: [
      { label: 'Weekly groups', value: '96' },
      { label: 'Carers supported', value: '2,100' },
      { label: 'Average session size', value: '11' },
    ],
    isFeatured: true,
    events: [
      { title: 'Greenwood Charity Day', venue: 'Ashcombe Links', inDays: 19,
        description: 'Team scramble with a shortened course, open to every ability.' },
    ],
  },
  {
    slug: 'harbour-lights-housing',
    name: 'Harbour Lights Housing',
    tagline: 'Emergency beds tonight, a tenancy within ninety days.',
    category: 'Housing & homelessness',
    region: 'Coastal',
    impactHeadline: '418 people moved into permanent housing',
    description:
      'Harbour Lights runs three night shelters and a rapid-rehousing team that works with private landlords. The model is simple: a bed the same evening, then a caseworker who stays with that person until the tenancy agreement is signed and the first month is behind them.',
    impactMetrics: [
      { label: 'People rehoused', value: '418' },
      { label: 'Beds each night', value: '84' },
      { label: 'Still housed at 12 months', value: '91%' },
    ],
    isFeatured: true,
    events: [{ title: 'Longest Day Golf Marathon', venue: 'Tern Bay Golf Club', inDays: 47 }],
  },
  {
    slug: 'meadowbank-veterans',
    name: 'Meadowbank Veterans Network',
    tagline: 'Peer support and adaptive sport for ex-service personnel.',
    category: 'Veterans',
    region: 'Midlands',
    impactHeadline: '2,800 members across 40 branches',
    description:
      'Meadowbank pairs recently discharged service personnel with veterans who left a decade earlier. Adaptive golf is the front door: it gets people through it, and the peer support, benefits advice and mental-health referrals follow.',
    impactMetrics: [
      { label: 'Active members', value: '2,800' },
      { label: 'Local branches', value: '40' },
      { label: 'Adaptive sets loaned', value: '460' },
    ],
    events: [{ title: 'Remembrance Fourball', venue: 'Meadowbank Park', inDays: 88 }],
  },
  {
    slug: 'river-and-fairway-trust',
    name: 'River & Fairway Trust',
    tagline: 'Turning out-of-play course land into working wildlife habitat.',
    category: 'Environment',
    region: 'National',
    impactHeadline: '640 hectares under restoration',
    description:
      'Roughly forty per cent of a typical golf course is never played. River & Fairway works with greenkeepers to convert that land into wildflower meadow, wet scrape and native scrub, then monitors the species that return. Sixty-one courses have signed up so far.',
    impactMetrics: [
      { label: 'Hectares restored', value: '640' },
      { label: 'Partner courses', value: '61' },
      { label: 'Bird species recorded', value: '134' },
    ],
    events: [{ title: 'Meadow planting weekend', venue: 'Stow Brook Course', inDays: 26 }],
  },
  {
    slug: 'bright-start-breakfast',
    name: 'Bright Start Breakfast',
    tagline: 'A hot breakfast before school, no questions asked.',
    category: 'Food & poverty',
    region: 'National',
    impactHeadline: '18,000 breakfasts served each week',
    description:
      'Bright Start funds breakfast clubs in primary schools where more than a third of pupils qualify for free school meals. Every child in the school is welcome, which removes the stigma that stops families taking up help they are entitled to.',
    impactMetrics: [
      { label: 'Breakfasts weekly', value: '18,000' },
      { label: 'Partner schools', value: '212' },
      { label: 'Cost per breakfast', value: '£0.41' },
    ],
    events: [],
  },
  {
    slug: 'clearwater-mental-health',
    name: 'Clearwater Mental Health',
    tagline: 'Counselling within two weeks, not two years.',
    category: 'Health',
    region: 'South',
    impactHeadline: '11-day average wait for a first session',
    description:
      'Clearwater runs a low-cost counselling service for adults stuck on NHS waiting lists, funded so that nobody is turned away for inability to pay. The charity also trains sports clubs to spot and respond to members in crisis.',
    impactMetrics: [
      { label: 'Average wait', value: '11 days' },
      { label: 'Sessions delivered', value: '34,000' },
      { label: 'Clients who pay nothing', value: '58%' },
    ],
    events: [{ title: 'Clearwater Pro-Am', venue: 'Sandhill Downs', inDays: 55 }],
  },
  {
    slug: 'nine-holes-for-hospice',
    name: 'Nine Holes for Hospice',
    tagline: 'Funding hospice nurses in the places with the fewest.',
    category: 'Hospice care',
    region: 'National',
    impactHeadline: '74 nurse posts funded',
    description:
      'Nine Holes for Hospice funds community palliative nursing in rural areas where the nearest inpatient hospice is more than an hour away. A funded post means a family can keep someone at home for their final weeks.',
    impactMetrics: [
      { label: 'Nurse posts funded', value: '74' },
      { label: 'Home visits a year', value: '52,000' },
      { label: 'Counties covered', value: '19' },
    ],
    events: [{ title: 'Midnight Nine', venue: 'Calder Vale', inDays: 12,
      description: 'Nine holes under floodlights, teeing off at 10pm.' }],
  },
];

export default charities;
