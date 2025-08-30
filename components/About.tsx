import React from 'react';
import { GiftIcon, ShieldCheckIcon, SparklesIcon, HandThumbUpIcon, BoltIcon, ArrowPathIcon } from './icons';

const About: React.FC = () => {

    const features = [
        {
            icon: GiftIcon,
            title: "Completely Free",
            description: "Access all 27 of our tools without any hidden fees, subscriptions, or limits. Powerful document processing is now available to everyone.",
        },
        {
            icon: ShieldCheckIcon,
            title: "Secure & Private",
            description: "Your privacy is our priority. All processing happens in your browser, so your files are never uploaded to our servers. Your data stays with you.",
        },
        {
            icon: SparklesIcon,
            title: "Powerful Features",
            description: "From merging and converting to our new advanced PDF editor, we provide a comprehensive suite of tools to handle any document task with ease.",
        },
        {
            icon: HandThumbUpIcon,
            title: "Simple & Intuitive",
            description: "Our clean interface is designed for everyone. No complicated software to install and no steep learning curve. Just click and get the job done.",
        },
        {
            icon: BoltIcon,
            title: "Reliable Performance",
            description: "Built with modern web technologies, DocxTools delivers fast and dependable results, processing your files in seconds without delay.",
        },
        {
            icon: ArrowPathIcon,
            title: "Always Improving",
            description: "We are constantly working to improve existing tools and add new features based on user feedback to be the best solution available online.",
        },
    ];

    return (
        <section id="about" className="py-20 bg-white dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16 reveal">
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        Why DocxTools is Your Go-To PDF Solution
                    </h2>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                        Discover the features and principles that make us the best choice for all your document management needs.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {features.map((feature, index) => (
                        <div key={index} className="text-center p-8 bg-gray-50 dark:bg-gray-900/50 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-transform duration-300 reveal">
                            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary-red text-white mx-auto mb-6">
                                <feature.icon className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                            <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default About;
